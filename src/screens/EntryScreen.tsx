import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { MemoPlayer } from '../components/MemoPlayer';
import { ScaleInput } from '../components/ScaleInput';
import { useDataVersion } from '../dataVersion';
import { addDays, formatDuration, formatLong, todayKey } from '../dates';
import {
  addMemo,
  deleteMemo,
  getEntry,
  getMemos,
  setAnswer,
  type Entry,
  type Memo,
  type MemoKind,
} from '../db';
import { deleteMemoFile, storeRecording } from '../memoFiles';
import { QUESTIONS, type QuestionKey } from '../questions';
import { colors } from '../theme';

interface Props {
  date: string;
  onChangeDate: (date: string) => void;
  onClose: () => void;
}

export function EntryScreen({ date, onChangeDate, onClose }: Props) {
  const db = useSQLiteContext();
  const { bump } = useDataVersion();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [recordingKind, setRecordingKind] = useState<MemoKind | null>(null);
  const [showDream, setShowDream] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);

  const load = useCallback(async () => {
    const [e, m] = await Promise.all([getEntry(db, date), getMemos(db, date)]);
    setEntry(e);
    setMemos(m);
    setShowDream(m.some((x) => x.kind === 'dream'));
  }, [db, date]);

  useEffect(() => {
    load();
  }, [load]);

  const isToday = date === todayKey();
  const canGoForward = date < todayKey();

  const answer = async (key: QuestionKey, value: number | null) => {
    setEntry((e) => (e ? { ...e, [key]: value } : e));
    await setAnswer(db, date, key, value);
    bump();
  };

  const startRecording = async (kind: MemoKind) => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone needed',
          'Please allow microphone access in your phone settings to record memos.',
        );
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingKind(kind);
    } catch (err) {
      Alert.alert('Could not start recording', String(err));
    }
  };

  const stopRecording = async () => {
    const kind = recordingKind;
    const duration = recState.durationMillis;
    setRecordingKind(null);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri || !kind) return;
      const file = storeRecording(uri, date, kind);
      await addMemo(db, date, kind, file, duration);
      await load();
      bump();
    } catch (err) {
      Alert.alert('Could not save recording', String(err));
    }
  };

  // Never leave the microphone running when leaving the screen.
  useEffect(() => {
    return () => {
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
            {kind === 'day' ? 'No memo yet. Tell your phone about your day.' : 'No dream memo yet.'}
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
                ? 'Record another memo'
                : 'Record memo'}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{isToday ? 'Today' : ' '}</Text>
        <Text style={styles.date}>{formatLong(date)}</Text>

        <Card title="Voice memo">{renderMemoSection('day')}</Card>

        <Card title="Quick check-in">
          {entry
            ? QUESTIONS.map((q) => (
                <ScaleInput key={q.key} question={q} value={entry[q.key]} onChange={(v) => answer(q.key, v)} />
              ))
            : null}
        </Card>

        {showDream ? (
          <Card title="🌙 Dream journal" style={{ backgroundColor: colors.dreamSoft }}>
            {renderMemoSection('dream')}
          </Card>
        ) : (
          <Pressable style={styles.addDream} onPress={() => setShowDream(true)}>
            <Text style={styles.addDreamText}>🌙  Add a dream</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
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
  empty: { color: colors.muted, marginBottom: 12 },
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
  addDream: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dream,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  addDreamText: { color: colors.dream, fontWeight: '700', fontSize: 16 },
});
