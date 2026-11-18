import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDataVersion } from '../dataVersion';
import { formatShort, todayKey } from '../dates';
import { listEntries, type EntrySummary } from '../db';
import { QUESTIONS, scoreColor } from '../questions';
import { colors, radius } from '../theme';

export function ListScreen({ onOpen }: { onOpen: (date: string) => void }) {
  const db = useSQLiteContext();
  const { version } = useDataVersion();
  const [entries, setEntries] = useState<EntrySummary[]>([]);

  useEffect(() => {
    listEntries(db).then(setEntries);
  }, [db, version]);

  const today = todayKey();
  const hasToday = entries[0]?.date === today;

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.date}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <Text style={styles.h1}>Journal</Text>
          <Pressable style={styles.todayBtn} onPress={() => onOpen(today)}>
            <Text style={styles.todayTitle}>{hasToday ? "Continue today's entry" : 'How was today?'}</Text>
            <Text style={styles.todaySub}>Tap to record a memo and check in</Text>
          </Pressable>
          {entries.length > 0 ? <Text style={styles.section}>Past entries</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Your entries will show up here. Start with today!</Text>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => onOpen(item.date)}>
          <View style={[styles.badge, { backgroundColor: scoreColor(item.rating) }]}>
            <Text style={styles.badgeText}>{item.rating ?? '–'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              {item.date === today ? 'Today' : formatShort(item.date)}
            </Text>
            <Text style={styles.rowSub}>
              {QUESTIONS.slice(1)
                .map((q) => `${q.short} ${item[q.key] ?? '–'}`)
                .join('  ·  ')}
            </Text>
          </View>
          <View style={styles.icons}>
            {item.day_memos > 0 ? <Text style={styles.icon}>🎙 {item.day_memos}</Text> : null}
            {item.dream_memos > 0 ? <Text style={styles.icon}>🌙 {item.dream_memos}</Text> : null}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 16 },
  todayBtn: { backgroundColor: colors.primary, borderRadius: radius, padding: 20, marginBottom: 24 },
  todayTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  todaySub: { color: '#DDE3FF', marginTop: 4 },
  section: { color: colors.muted, fontWeight: '700', textTransform: 'uppercase', fontSize: 12, marginBottom: 8 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  rowTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  icons: { alignItems: 'flex-end', gap: 2 },
  icon: { fontSize: 12, color: colors.muted },
});
