import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { formatDuration } from '../dates';
import type { Memo } from '../db';
import { memoUri } from '../memoFiles';
import { makeStyles, useColors } from '../theme';

interface Props {
  memo: Memo;
  index: number;
  accent: string;
  onDelete: (memo: Memo) => void;
}

export function MemoPlayer({ memo, index, accent, onDelete }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const player = useAudioPlayer(memoUri(memo.file));
  const status = useAudioPlayerStatus(player);

  const durationS = status.duration > 0 ? status.duration : memo.duration_ms / 1000;
  const progress = durationS > 0 ? Math.min(1, status.currentTime / durationS) : 0;
  const finished = durationS > 0 && status.currentTime >= durationS - 0.05;

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (finished) await player.seekTo(0);
    player.play();
  };

  const confirmDelete = () =>
    Alert.alert('Delete memo?', 'This recording will be removed permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          player.pause();
          onDelete(memo);
        },
      },
    ]);

  const time = new Date(memo.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        style={[styles.play, { backgroundColor: accent }]}
        accessibilityLabel={status.playing ? 'Pause memo' : 'Play memo'}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16">
          {status.playing ? (
            <>
              <Rect x="3" y="2" width="3.5" height="12" rx="1" fill="#fff" />
              <Rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="#fff" />
            </>
          ) : (
            <Path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z" fill="#fff" />
          )}
        </Svg>
      </Pressable>
      <View style={styles.middle}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Memo {index + 1}</Text>
          <Text style={styles.time}>
            {status.playing || status.currentTime > 0
              ? `${formatDuration(status.currentTime * 1000)} / ${formatDuration(durationS * 1000)}`
              : `${formatDuration(durationS * 1000)} · ${time}`}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        </View>
      </View>
      <Pressable onPress={confirmDelete} hitSlop={12} accessibilityLabel="Delete memo">
        <Text style={[styles.delete, { color: colors.faint }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.cardAlt,
      borderRadius: 16,
      padding: 10,
      marginBottom: 8,
    },
    play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    middle: { flex: 1, gap: 8 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    title: { color: c.text, fontWeight: '600' },
    time: { color: c.muted, fontSize: 12 },
    track: { height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
    fill: { height: 4 },
    delete: { fontSize: 16, paddingHorizontal: 4 },
  }),
);
