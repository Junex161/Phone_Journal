import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../dates';
import type { Memo } from '../db';
import { memoUri } from '../memoFiles';
import { colors } from '../theme';

interface Props {
  memo: Memo;
  index: number;
  accent: string;
  onDelete: (memo: Memo) => void;
}

export function MemoPlayer({ memo, index, accent, onDelete }: Props) {
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

  const time = new Date(memo.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        style={[styles.play, { backgroundColor: accent }]}
        accessibilityLabel={status.playing ? 'Pause memo' : 'Play memo'}
      >
        <Text style={styles.playIcon}>{status.playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={styles.middle}>
        <Text style={styles.title}>
          Memo {index + 1} <Text style={styles.time}>· {time}</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        </View>
        <Text style={styles.time}>
          {formatDuration(status.currentTime * 1000)} / {formatDuration(durationS * 1000)}
        </Text>
      </View>
      <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Delete memo">
        <Text style={styles.delete}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
  middle: { flex: 1, gap: 4 },
  title: { color: colors.text, fontWeight: '600' },
  time: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 4 },
  delete: { color: colors.muted, fontSize: 18, paddingHorizontal: 4 },
});
