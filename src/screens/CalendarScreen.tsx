import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { useDataVersion } from '../dataVersion';
import { daysInMonth, MONTHS, toKey, todayKey, WEEKDAYS_SHORT, weekdayMon } from '../dates';
import { listEntries, type EntrySummary } from '../db';
import { scoreColor } from '../questions';
import { colors } from '../theme';

export function CalendarScreen({ onOpen }: { onOpen: (date: string) => void }) {
  const db = useSQLiteContext();
  const { version } = useDataVersion();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [byDate, setByDate] = useState<Record<string, EntrySummary>>({});

  useEffect(() => {
    listEntries(db).then((rows) => {
      const map: Record<string, EntrySummary> = {};
      rows.forEach((r) => (map[r.date] = r));
      setByDate(map);
    });
  }, [db, version]);

  const today = todayKey();
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const lead = weekdayMon(first);
    const n = daysInMonth(year, month);
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= n; d++) out.push(toKey(new Date(year, month, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [year, month]);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const monthEntries = cells.filter((c): c is string => !!c && !!byDate[c]);
  const ratings = monthEntries.map((c) => byDate[c].rating).filter((r): r is number => r != null);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Calendar</Text>
      <Card>
        <View style={styles.monthNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12} disabled={isCurrentMonth}>
            <Text style={[styles.arrow, isCurrentMonth && { opacity: 0.25 }]}>›</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {WEEKDAYS_SHORT.map((w) => (
            <Text key={w} style={styles.weekday}>
              {w}
            </Text>
          ))}
          {cells.map((key, i) => {
            if (!key) return <View key={`e${i}`} style={styles.cell} />;
            const e = byDate[key];
            const future = key > today;
            const day = Number(key.slice(8));
            return (
              <Pressable key={key} style={styles.cell} disabled={future} onPress={() => onOpen(key)}>
                <View
                  style={[
                    styles.dayCircle,
                    e && { backgroundColor: e.rating != null ? scoreColor(e.rating) : colors.primarySoft },
                    key === today && styles.todayRing,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      future && { color: colors.border },
                      e?.rating != null && { color: '#fff', fontWeight: '800' },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {e?.dream_memos ? <Text style={styles.moon}>🌙</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card>
        <Text style={styles.summary}>
          {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'} this month
          {avg != null ? `  ·  average day ${avg.toFixed(1)}` : ''}
        </Text>
        <Text style={styles.legend}>Colour = day rating (red 1 → green 10). 🌙 = dream recorded.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 16 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  arrow: { fontSize: 30, color: colors.primary, paddingHorizontal: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, marginBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 2, borderColor: colors.primary },
  dayText: { color: colors.text, fontWeight: '500' },
  moon: { position: 'absolute', bottom: 0, right: 4, fontSize: 10 },
  summary: { fontWeight: '700', color: colors.text },
  legend: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
