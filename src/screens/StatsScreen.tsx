import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Card } from '../components/Card';
import { useDataVersion } from '../dataVersion';
import { fromKey, MONTHS, MONTHS_SHORT } from '../dates';
import { answersBetween, type Entry } from '../db';
import { QUESTIONS, type QuestionKey } from '../questions';
import { mean, movingAverage, variance, welchTTest } from '../stats';
import { colors } from '../theme';

const CHART_H = 180;
const PAD_L = 26;
const PAD_B = 22;
const PAD_T = 8;

export function StatsScreen() {
  const db = useSQLiteContext();
  const { version } = useDataVersion();
  const { width } = useWindowDimensions();
  const chartW = width - 32 - 32; // screen padding + card padding

  const [year, setYear] = useState(new Date().getFullYear());
  const [metric, setMetric] = useState<QuestionKey>('rating');
  const [rows, setRows] = useState<Entry[]>([]);
  const [monthA, setMonthA] = useState<number | null>(null);
  const [monthB, setMonthB] = useState<number | null>(null);

  useEffect(() => {
    answersBetween(db, `${year}-01-01`, `${year}-12-31`).then(setRows);
  }, [db, version, year]);

  const question = QUESTIONS.find((q) => q.key === metric)!;

  const points = useMemo(
    () =>
      rows
        .filter((r) => r[metric] != null)
        .map((r) => ({ date: r.date, value: r[metric] as number, month: fromKey(r.date).getMonth() })),
    [rows, metric],
  );

  const byMonth = useMemo(() => {
    const groups: number[][] = Array.from({ length: 12 }, () => []);
    points.forEach((p) => groups[p.month].push(p.value));
    return groups;
  }, [points]);

  const monthsWithData = byMonth.map((g, i) => (g.length ? i : -1)).filter((i) => i >= 0);

  // Default comparison: the two most recent months that have data.
  useEffect(() => {
    const m = monthsWithData;
    setMonthB(m.length ? m[m.length - 1] : null);
    setMonthA(m.length > 1 ? m[m.length - 2] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, metric, rows.length]);

  const yearAvg = points.length ? mean(points.map((p) => p.value)) : null;
  const test =
    monthA != null && monthB != null && monthA !== monthB ? welchTTest(byMonth[monthA], byMonth[monthB]) : null;

  // --- chart geometry ---
  const plotW = chartW - PAD_L;
  const plotH = CHART_H - PAD_B - PAD_T;
  const y = (v: number) => PAD_T + plotH - ((v - 1) / 9) * plotH;
  const isLeap = new Date(year, 1, 29).getMonth() === 1;
  const daysInYear = isLeap ? 366 : 365;
  const dayOfYear = (key: string) => {
    const d = fromKey(key);
    return Math.round((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000);
  };
  const xDay = (doy: number) => PAD_L + (doy / (daysInYear - 1)) * plotW;
  const ma = movingAverage(points.map((p) => p.value), 7);
  const maPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xDay(dayOfYear(p.date)).toFixed(1)},${y(ma[i]).toFixed(1)}`)
    .join(' ');

  const barSlot = plotW / 12;

  const gridLines = [1, 4, 7, 10].map((v) => (
    <Line key={v} x1={PAD_L} x2={chartW} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
  ));
  const gridLabels = [1, 4, 7, 10].map((v) => (
    <SvgText key={`l${v}`} x={PAD_L - 6} y={y(v) + 4} fontSize={10} fill={colors.muted} textAnchor="end">
      {v}
    </SvgText>
  ));
  const monthLabels = (xFor: (m: number) => number) =>
    MONTHS_SHORT.map((m, i) => (
      <SvgText key={m} x={xFor(i)} y={CHART_H - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
        {m[0]}
      </SvgText>
    ));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Statistics</Text>

      <View style={styles.yearNav}>
        <Pressable onPress={() => setYear(year - 1)} hitSlop={12}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.year}>{year}</Text>
        <Pressable onPress={() => setYear(year + 1)} hitSlop={12} disabled={year >= new Date().getFullYear()}>
          <Text style={[styles.arrow, year >= new Date().getFullYear() && { opacity: 0.25 }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {QUESTIONS.map((q) => (
          <Pressable
            key={q.key}
            onPress={() => setMetric(q.key)}
            style={[styles.chip, metric === q.key && { backgroundColor: q.color, borderColor: q.color }]}
          >
            <Text style={[styles.chipText, metric === q.key && { color: '#fff' }]}>{q.short}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tiles}>
        <Tile label="Check-ins" value={String(points.length)} />
        <Tile label="Year average" value={yearAvg != null ? yearAvg.toFixed(1) : '–'} />
        <Tile
          label="Best month"
          value={
            monthsWithData.length
              ? MONTHS_SHORT[monthsWithData.reduce((best, m) => (mean(byMonth[m]) > mean(byMonth[best]) ? m : best))]
              : '–'
          }
        />
      </View>

      {points.length === 0 ? (
        <Card>
          <Text style={styles.muted}>No check-ins for {year} yet. Answer the quick questions in an entry to see your progress here.</Text>
        </Card>
      ) : (
        <>
          <Card title={`${question.short} over the year`}>
            <Svg width={chartW} height={CHART_H}>
              {gridLines}
              {gridLabels}
              {points.map((p) => (
                <Circle key={p.date} cx={xDay(dayOfYear(p.date))} cy={y(p.value)} r={2.5} fill={question.color} opacity={0.35} />
              ))}
              {points.length > 1 ? <Path d={maPath} stroke={question.color} strokeWidth={2.5} fill="none" /> : null}
              {monthLabels((m) => xDay(dayOfYear(`${year}-${String(m + 1).padStart(2, '0')}-15`)))}
            </Svg>
            <Text style={styles.caption}>Dots = single days, line = 7-entry moving average.</Text>
          </Card>

          <Card title="Monthly average">
            <Svg width={chartW} height={CHART_H}>
              {gridLines}
              {gridLabels}
              {byMonth.map((g, i) => {
                if (!g.length) return null;
                const m = mean(g);
                const se = g.length > 1 ? Math.sqrt(variance(g) / g.length) : 0;
                const cx = PAD_L + barSlot * i + barSlot / 2;
                const bw = barSlot * 0.6;
                const highlighted = i === monthA || i === monthB;
                return (
                  <G key={i}>
                    <Rect
                      x={cx - bw / 2}
                      y={y(m)}
                      width={bw}
                      height={y(1) - y(m) + 0.01}
                      rx={3}
                      fill={question.color}
                      opacity={highlighted ? 1 : 0.45}
                    />
                    {se > 0 ? (
                      <Line x1={cx} x2={cx} y1={y(Math.min(10, m + se))} y2={y(Math.max(1, m - se))} stroke={colors.text} strokeWidth={1} />
                    ) : null}
                  </G>
                );
              })}
              {monthLabels((m) => PAD_L + barSlot * m + barSlot / 2)}
            </Svg>
            <Text style={styles.caption}>Whiskers = ± standard error. Tap months below to compare.</Text>
          </Card>

          <Card title="Compare two months">
            <MonthPicker label="Month A" value={monthA} months={monthsWithData} onChange={setMonthA} />
            <MonthPicker label="Month B" value={monthB} months={monthsWithData} onChange={setMonthB} />
            <ComparisonResult
              test={test}
              monthA={monthA}
              monthB={monthB}
              nA={monthA != null ? byMonth[monthA].length : 0}
              nB={monthB != null ? byMonth[monthB].length : 0}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function MonthPicker({
  label,
  value,
  months,
  onChange,
}: {
  label: string;
  value: number | null;
  months: number[];
  onChange: (m: number) => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {months.map((m) => (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[styles.monthChip, value === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={[styles.chipText, value === m && { color: '#fff' }]}>{MONTHS_SHORT[m]}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ComparisonResult({
  test,
  monthA,
  monthB,
  nA,
  nB,
}: {
  test: ReturnType<typeof welchTTest>;
  monthA: number | null;
  monthB: number | null;
  nA: number;
  nB: number;
}) {
  if (monthA == null || monthB == null) {
    return <Text style={styles.muted}>You need check-ins in at least two months to compare.</Text>;
  }
  if (monthA === monthB) return <Text style={styles.muted}>Pick two different months.</Text>;
  if (!test) {
    return (
      <Text style={styles.muted}>
        Need at least 2 check-ins in each month (have {nA} in {MONTHS_SHORT[monthA]}, {nB} in {MONTHS_SHORT[monthB]}).
      </Text>
    );
  }
  const diff = test.meanB - test.meanA;
  const significant = test.p < 0.05;
  const direction = diff > 0 ? 'higher' : 'lower';
  const pText = test.p < 0.001 ? 'p < 0.001' : `p = ${test.p.toFixed(3)}`;
  return (
    <View style={styles.result}>
      <View style={styles.resultRow}>
        <View style={styles.resultCol}>
          <Text style={styles.resultMonth}>{MONTHS[monthA]}</Text>
          <Text style={styles.resultMean}>{test.meanA.toFixed(2)}</Text>
          <Text style={styles.muted}>n = {test.nA}</Text>
        </View>
        <Text style={styles.vs}>vs</Text>
        <View style={styles.resultCol}>
          <Text style={styles.resultMonth}>{MONTHS[monthB]}</Text>
          <Text style={styles.resultMean}>{test.meanB.toFixed(2)}</Text>
          <Text style={styles.muted}>n = {test.nB}</Text>
        </View>
      </View>
      <Text style={[styles.verdict, { color: significant ? '#0E9F6E' : colors.muted }]}>
        {significant
          ? `${MONTHS[monthB]} was significantly ${direction} (${pText}).`
          : `No significant difference (${pText}).`}
      </Text>
      <Text style={styles.caption}>
        Welch's t-test: t = {test.t.toFixed(2)}, df = {test.df.toFixed(1)}, Cohen's d = {test.d.toFixed(2)}.
        {'\n'}Significant means p {'<'} 0.05. With few check-ins per month, treat results as a rough hint.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 8 },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 8 },
  arrow: { fontSize: 30, color: colors.primary },
  year: { fontSize: 20, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 14, justifyContent: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  chipText: { color: colors.text, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, alignItems: 'center' },
  tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  caption: { color: colors.muted, fontSize: 12, marginTop: 8 },
  muted: { color: colors.muted },
  pickerLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginRight: 6, backgroundColor: '#fff' },
  result: { marginTop: 8, padding: 12, backgroundColor: colors.bg, borderRadius: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  resultCol: { alignItems: 'center' },
  resultMonth: { fontWeight: '700', color: colors.text },
  resultMean: { fontSize: 26, fontWeight: '800', color: colors.text },
  vs: { color: colors.muted, fontWeight: '700' },
  verdict: { marginTop: 10, fontWeight: '700', textAlign: 'center' },
});
