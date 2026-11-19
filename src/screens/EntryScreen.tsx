import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { HoursStepper } from '../components/HoursStepper';
import { Icon } from '../components/Icon';
import { MemoPlayer } from '../components/MemoPlayer';
import { ScaleInput } from '../components/ScaleInput';
import { SocialInput } from '../components/SocialInput';
import { useDataVersion } from '../dataVersion';
import { addDays, formatDuration, formatLong, fromKey, todayKey } from '../dates';
import {
  addMemo,
  deleteMemo,
  getEntry,
  getMemos,
  isDayDone,
  lastSleepHours,
  setField,
  type Entry,
  type EntryField,
  type Memo,
  type MemoKind,
} from '../db';
import { deleteMemoFile, storeRecording } from '../memoFiles';
import { DAY_SCALES, SLEEP_SCALES } from '../questions';
import { recordingGuard } from '../recordingGuard';
import { makeStyles, useColors } from '../theme';

interface Props {
  date: string;
  onChangeDate: (date: string) => void;
  onClose: () => void;
}

interface PendingRecording {
  kind: MemoKind;
  date: string;
  fileName: string;
}

type Part = 'day' | 'night';

function progress(e: Entry, dayMemos: number) {
  const day = [dayMemos > 0, e.rating != null, e.social != null, e.growth != null];
  const night = [e.sleep_hours != null, e.dream_vibe != null, e.rested != null];
  return {
    day: day.filter(Boolean).length,
    dayTotal: day.length,
    night: night.filter(Boolean).length,
    nightTotal: night.length,
  };
}

export function EntryScreen({ date, onChangeDate, onClose }: Props) {
  const db = useSQLiteContext();
  const styles = useStyles();
  const colors = useColors();
  const { bump } = useDataVersion();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [sleepSuggestion, setSleepSuggestion] = useState<number | null>(null);
  const [recordingKind, setRecordingKind] = useState<MemoKind | null>(null);
  const [part, setPart] = useState<Part>('day');
  // Render the body only once everything is loaded, so nothing (like the done banner) pops in late.
  const [loaded, setLoaded] = useState(false);
  const pending = useRef<PendingRecording | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);

  const load = useCallback(async () => {
    const [e, m, s] = await Promise.all([getEntry(db, date), getMemos(db, date), lastSleepHours(db, date)]);
    setEntry(e);
    setMemos(m);
    setSleepSuggestion(s);
    return { e, m };
  }, [db, date]);

  useEffect(() => {
    load().then(({ e, m }) => {
      // In the morning, open today's entry on the night part if it's still empty.
      const p = progress(e, m.filter((x) => x.kind === 'day').length);
      if (date === todayKey() && new Date().getHours() < 12 && p.night < p.nightTotal) setPart('night');
      setLoaded(true);
    });
  }, [load, date]);

  const isToday = date === todayKey();
  const canGoForward = date < todayKey();
  const dayMemoCount = memos.filter((m) => m.kind === 'day').length;
  const done = entry ? isDayDone(entry, dayMemoCount) : false;
  const prog = entry ? progress(entry, dayMemoCount) : null;

  const update = async (field: EntryField, value: number | string | null) => {
    setEntry((e) => (e ? { ...e, [field]: value } : e));
    await setField(db, date, field, value);
    bump();
  };

  const startRecording = async (kind: MemoKind) => {
    if (pending.current) return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Please allow microphone access in your phone settings to record memos.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      // Every recording gets its own unique file name up front, so a finished recording can
      // never be confused with an older file.
      const fileName = `${date}_${kind}_${Date.now()}`;
      await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, directory: 'document', fileName });
      recorder.record();
      pending.current = { kind, date, fileName };
      recordingGuard.active = true;
      setRecordingKind(kind);
    } catch (err) {
      pending.current = null;
      recordingGuard.active = false;
      Alert.alert('Could not start recording', String(err));
    }
  };

  const stopRecording = async () => {
    const p = pending.current;
    if (!p) return;
    const duration = recorder.getStatus().durationMillis || recState.durationMillis;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const file = storeRecording(recorder.uri, p.fileName);
      await addMemo(db, p.date, p.kind, file, duration);
      await load();
      bump();
    } catch (err) {
      Alert.alert('Could not save recording', String(err));
    } finally {
      pending.current = null;
      recordingGuard.active = false;
      setRecordingKind(null);
    }
  };

  // Never leave the microphone running when leaving the screen.
  useEffect(() => {
    return () => {
      recordingGuard.active = false;
      try {
        if (recorder.isRecording) recorder.stop().catch(() => {});
      } catch {
        // Recorder may already be released by the hook.
      }
    };
  }, [recorder]);

  const removeMemo = async (memo: Memo) => {
    await deleteMemo(db, memo.id);
    deleteMemoFile(memo.file);
    await load();
    bump();
  };

  const guarded = (fn: () => void) => () => {
    if (recordingKind) {
      Alert.alert('Recording in progress', 'Stop the recording first.');
      return;
    }
    fn();
  };

  const renderMemos = (kind: MemoKind) => {
    const list = memos.filter((m) => m.kind === kind);
    const accent = kind === 'day' ? colors.primary : colors.dream;
    const recordingThis = recordingKind === kind;
    const otherRecording = recordingKind !== null && !recordingThis;
    const label = recordingThis
      ? `Stop  ·  ${formatDuration(recState.durationMillis)}`
      : kind === 'day'
        ? list.length
          ? 'Add another memo'
          : 'Record memo'
        : list.length
          ? 'Add another dream'
          : 'Record dream';
    return (
      <View>
        {list.map((m, i) => (
          <MemoPlayer key={m.id} memo={m} index={i} accent={accent} onDelete={removeMemo} />
        ))}
        {list.length === 0 && !recordingThis ? (
          <Text style={styles.empty}>
            {kind === 'day' ? 'Tell your phone about your day.' : 'Remember a dream? Record it here.'}
          </Text>
        ) : null}
        <Pressable
          disabled={otherRecording}
          onPress={() => (recordingThis ? stopRecording() : startRecording(kind))}
          style={[
            styles.recordBtn,
            { backgroundColor: recordingThis ? colors.record : accent },
            otherRecording && { opacity: 0.4 },
          ]}
        >
          {recordingThis ? <View style={styles.stopIcon} /> : <Icon name="mic" size={20} color="#fff" />}
          <Text style={styles.recordText}>{label}</Text>
        </Pressable>
      </View>
    );
  };

  const weekday = fromKey(date).toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={guarded(onClose)} hitSlop={12} style={styles.iconBtn} accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.dayNav}>
          <Pressable
            onPress={guarded(() => onChangeDate(addDays(date, -1)))}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Previous day"
          >
            <Icon name="chevronLeft" size={20} color={colors.muted} />
          </Pressable>
          <Pressable
            disabled={!canGoForward}
            onPress={guarded(() => onChangeDate(addDays(date, 1)))}
            hitSlop={12}
            style={[styles.iconBtn, !canGoForward && { opacity: 0.3 }]}
            accessibilityLabel="Next day"
          >
            <Icon name="chevronRight" size={20} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isToday ? 'Today' : weekday}</Text>
        <Text style={styles.subtitle}>{formatLong(date)}</Text>

        {!loaded || !entry || !prog ? null : (
          <>
            {done ? (
              <View style={styles.doneBanner}>
                <Icon name="check" size={18} color={colors.success} strokeWidth={2.5} />
                <Text style={styles.doneText}>{isToday ? "You're done for today" : 'This day is complete'}</Text>
              </View>
            ) : null}

            <View style={styles.segment}>
              {(
                [
                  { key: 'day', label: 'Day', icon: 'sun', n: prog.day, total: prog.dayTotal, accent: colors.primary },
                  { key: 'night', label: 'Night', icon: 'moon', n: prog.night, total: prog.nightTotal, accent: colors.dream },
                ] as const
              ).map((s) => {
                const on = part === s.key;
                const complete = s.n === s.total;
                return (
                  <Pressable key={s.key} onPress={guarded(() => setPart(s.key))} style={[styles.segBtn, on && styles.segOn]}>
                    <Icon name={s.icon} size={18} color={on ? s.accent : colors.muted} />
                    <Text style={[styles.segText, on && { color: colors.text }]}>{s.label}</Text>
                    <View style={[styles.badge, complete && { backgroundColor: colors.successSoft }]}>
                      <Text style={[styles.badgeText, complete && { color: colors.success }]}>
                        {complete ? '✓' : `${s.n}/${s.total}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {part === 'day' ? (
              <>
                <Card title="Voice memo">{renderMemos('day')}</Card>
                <Card title="Daily Survey">
                  <ScaleInput question={DAY_SCALES.rating} value={entry.rating} onChange={(v) => update('rating', v)} />
                  <SocialInput
                    social={entry.social}
                    withWho={entry.social_with}
                    note={entry.social_note}
                    onSocial={(v) => update('social', v)}
                    onWith={(v) => update('social_with', v)}
                    onNote={(v) => update('social_note', v)}
                  />
                  <ScaleInput question={DAY_SCALES.growth} value={entry.growth} onChange={(v) => update('growth', v)} />
                </Card>
              </>
            ) : (
              <>
                <Card title="Last night">
                  <HoursStepper
                    value={entry.sleep_hours}
                    suggestion={sleepSuggestion}
                    onChange={(v) => update('sleep_hours', v)}
                  />
                  <ScaleInput
                    question={SLEEP_SCALES.dream_vibe}
                    value={entry.dream_vibe}
                    onChange={(v) => update('dream_vibe', v)}
                  />
                  <ScaleInput question={SLEEP_SCALES.rested} value={entry.rested} onChange={(v) => update('rested', v)} />
                </Card>
                <Card title="Dream journal">{renderMemos('dream')}</Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
    },
    dayNav: { flexDirection: 'row', gap: 10 },
    content: { padding: 16, paddingTop: 4, paddingBottom: 48 },
    title: { fontSize: 32, fontWeight: '800', color: c.text },
    subtitle: { fontSize: 15, color: c.muted, marginTop: 2, marginBottom: 18 },
    doneBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.successSoft,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    doneText: { color: c.success, fontWeight: '700', fontSize: 15 },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 4,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    segBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    segOn: { backgroundColor: c.cardAlt },
    segText: { fontWeight: '700', color: c.muted, fontSize: 15 },
    badge: { backgroundColor: c.border, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1 },
    badgeText: { fontSize: 11, fontWeight: '700', color: c.muted },
    empty: { color: c.muted, marginBottom: 12 },
    recordBtn: {
      marginTop: 6,
      height: 54,
      borderRadius: 27,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    stopIcon: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#fff' },
    recordText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  }),
);
