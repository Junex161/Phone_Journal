import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { formatHours } from '../components/HoursStepper';
import { useDataVersion } from '../dataVersion';
import { addDays, daysInMonth, MONTHS, toKey, todayKey, WEEKDAYS_SHORT, weekdayMon } from '../dates';
import { isDayDone, listEntries, type EntrySummary } from '../db';
import { scoreColor } from '../questions';
import { mean } from '../stats';
import { makeStyles, useColors } from '../theme';

export function CalendarScreen({ onOpen }: { onOpen: (date: string) => void }) {
  const styles = useStyles();
  const colors = useColors();
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

  const monthEntries = cells.filter((c): c is string => !!c && !!byDate[c]).map((c) => byDate[c]);
  const avgOf = (pick: (e: EntrySummary) => number | null) => {
    const xs = monthEntries.map(pick).filter((x): x is number => x != null);
    return xs.length ? mean(xs) : null;
  };
  const socialAnswered = monthEntries.filter((e) => e.social != null);
  const socialDays = socialAnswered.filter((e) => e.social === 1).length;
  const doneDays = monthEntries.filter((e) => isDayDone(e, e.day_memos)).length;
  const dreams = monthEntries.reduce((a, e) => a + e.dream_memos, 0);

  // Current streak: consecutive days with an entry, ending today (or yesterday if today is still open).
  let streak = 0;
  let cursor = byDate[today] ? today : addDays(today, -1);
  while (byDate[cursor]) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const fmt = (v: number | null, digits = 1) => (v == null ? '–' : v.toFixed(digits));
  const avgSleep = avgOf((e) => e.sleep_hours);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Calendar</Text>
      <Card>
        <View style={styles.monthNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Icon name="chevronLeft" size={22} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12} disabled={isCurrentMonth}>
            <View style={isCurrentMonth && { opacity: 0.25 }}><Icon name="chevronRight" size={22} color={colors.primary} /></View>
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
                      future && { color: colors.faint },
                      e?.rating != null && { color: '#fff', fontWeight: '800' },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title={`${MONTHS[month]} at a glance`}>
        <View style={styles.statGrid}>
          <Stat label="Entries" value={String(monthEntries.length)} />
          <Stat label="Complete days" value={String(doneDays)} />
          <Stat label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
          <Stat label="Ø Day" value={fmt(avgOf((e) => e.rating))} />
          <Stat label="Ø Growth" value={fmt(avgOf((e) => e.growth))} />
          <Stat
            label="Social days"
            value={socialAnswered.length ? `${socialDays} / ${socialAnswered.length}` : '–'}
          />
          <Stat label="Ø Sleep" value={avgSleep == null ? '–' : `${formatHours(Math.round(avgSleep * 10) / 10)} h`} />
          <Stat label="Ø Rested" value={fmt(avgOf((e) => e.rested))} />
          <Stat label="Ø Dream vibe" value={fmt(avgOf((e) => e.dream_vibe))} />
          <Stat label="Dreams recorded" value={String(dreams)} />
        </View>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 18, marginTop: 4 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  arrow: { fontSize: 30, color: colors.primary, paddingHorizontal: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, marginBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 2, borderColor: colors.primary },
  dayText: { color: colors.text, fontWeight: '500' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  stat: { width: '50%' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
}));
