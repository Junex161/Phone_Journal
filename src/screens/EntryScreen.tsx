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
import { MemoPlayer } from '../components/MemoPlayer';
import { ScaleInput } from '../components/ScaleInput';
import { SocialInput } from '../components/SocialInput';
import { useDataVersion } from '../dataVersion';
import { addDays, formatDuration, formatLong, todayKey } from '../dates';
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
import { colors } from '../theme';

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

export function EntryScreen({ date, onChangeDate, onClose }: Props) {
  const db = useSQLiteContext();
  const { bump } = useDataVersion();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [sleepSuggestion, setSleepSuggestion] = useState<number | null>(null);
  const [recordingKind, setRecordingKind] = useState<MemoKind | null>(null);
  const pending = useRef<PendingRecording | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);

  const load = useCallback(async () => {
    const [e, m, s] = await Promise.all([getEntry(db, date), getMemos(db, date), lastSleepHours(db, date)]);
    setEntry(e);
    setMemos(m);
    setSleepSuggestion(s);
  }, [db, date]);

  useEffect(() => {
    load();
  }, [load]);

  const isToday = date === todayKey();
  const canGoForward = date < todayKey();
  const dayMemoCount = memos.filter((m) => m.kind === 'day').length;
  const done = entry ? isDayDone(entry, dayMemoCount) : false;

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

  const guardedNavigate = (fn: () => void) => {
    if (recordingKind) {
      Alert.alert('Recording in progress', 'Stop the recording first.');
      return;
    }
    fn();
  };

  const renderMemoSection = (kind: MemoKind) => {
    const list = memos.filter((m) => m.kind === kind);
    const accent = kind === 'day' ? colors.primary : colors.dream;
    const recordingThis = recordingKind === kind;
    const otherRecording = recordingKind !== null && !recordingThis;
    return (
      <View>
        {list.map((m, i) => (
          <MemoPlayer key={m.id} memo={m} index={i} accent={accent} onDelete={removeMemo} />
        ))}
        {list.length === 0 && !recordingThis ? (
          <Text style={styles.empty}>
            {kind === 'day' ? 'No memo yet. Tell your phone about your day.' : 'Remember a dream? Record it here.'}
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
          <View style={recordingThis ? styles.stopIcon : styles.recDot} />
          <Text style={styles.recordText}>
            {recordingThis
              ? `Stop  ·  ${formatDuration(recState.durationMillis)}`
              : list.length
                ? kind === 'day'
                  ? 'Record another memo'
                  : 'Record another dream'
                : kind === 'day'
                  ? 'Record memo'
                  : 'Record dream'}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => guardedNavigate(onClose)} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <View style={styles.dayNav}>
          <Pressable onPress={() => guardedNavigate(() => onChangeDate(addDays(date, -1)))} hitSlop={12}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Pressable
            disabled={!canGoForward}
            onPress={() => guardedNavigate(() => onChangeDate(addDays(date, 1)))}
            hitSlop={12}
          >
            <Text style={[styles.arrow, !canGoForward && { opacity: 0.25 }]}>›</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{isToday ? 'Today' : ' '}</Text>
        <Text style={styles.date}>{formatLong(date)}</Text>

        {done ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>✓ {isToday ? "You're done for today" : 'This day is complete'}</Text>
          </View>
        ) : null}

        <Card title="☀️ Your day">{renderMemoSection('day')}</Card>

        <Card title="Daily Survey">
          {entry ? (
            <>
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
            </>
          ) : null}
        </Card>

        <Card title="🌙 Sleep & Dreams" style={{ backgroundColor: colors.dreamSoft }}>
          <Text style={styles.nightHint}>About last night (the night before this day)</Text>
          {entry ? (
            <>
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
            </>
          ) : null}
          <Text style={styles.subTitle}>Dream journal</Text>
          {renderMemoSection('dream')}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { fontSize: 18, color: colors.primary, fontWeight: '600' },
  dayNav: { flexDirection: 'row', gap: 28 },
  arrow: { fontSize: 30, color: colors.primary, lineHeight: 32 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 48 },
  kicker: { color: colors.primary, fontWeight: '700', textTransform: 'uppercase', fontSize: 12 },
  date: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 },
  doneBox: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  doneText: { color: colors.success, fontWeight: '800', fontSize: 16 },
  empty: { color: colors.muted, marginBottom: 12 },
  nightHint: { color: colors.muted, fontSize: 12, marginTop: -6, marginBottom: 14 },
  subTitle: { fontSize: 15, fontWeight: '700', color: colors.dream, marginTop: 4, marginBottom: 4 },
  recordBtn: {
    marginTop: 8,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
  stopIcon: { width: 14, height: 14, borderRadius: 2, backgroundColor: '#fff' },
  recordText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
