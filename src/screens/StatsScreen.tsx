import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { useDataVersion } from '../dataVersion';
import { fromKey, MONTHS } from '../dates';
import { allAnswers, type Entry } from '../db';
import { metricByKey, METRICS, type Metric, type MetricKey } from '../questions';
import { describeR, mean, movingAverage, pearson, variance, welchTTest } from '../stats';
import { makeStyles, useColors } from '../theme';

const CHART_H = 180;
const PAD_L = 28;
const PAD_B = 22;
const PAD_T = 8;

/** A calendar month across years, encoded as year * 12 + month. */
type MonthId = number;
const monthId = (key: string): MonthId => {
  const d = fromKey(key);
  return d.getFullYear() * 12 + d.getMonth();
};
const monthName = (id: MonthId) => `${MONTHS[id % 12]} ${Math.floor(id / 12)}`;

const pText = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);
const fmtVal = (m: Metric, v: number, digits = 1) => `${v.toFixed(digits)}${m.unit ? ` ${m.unit}` : ''}`;

export function StatsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const db = useSQLiteContext();
  const { version } = useDataVersion();
  const { width } = useWindowDimensions();
  const chartW = width - 32 - 32; // screen padding + card padding
  const thisYear = new Date().getFullYear();

  const [rows, setRows] = useState<Entry[]>([]);
  const [year, setYear] = useState(thisYear);
  const [metricKey, setMetricKey] = useState<MetricKey>('rating');
  const [monthA, setMonthA] = useState<MonthId | null>(null);
  const [monthB, setMonthB] = useState<MonthId | null>(null);
  const [corrX, setCorrX] = useState<MetricKey>('dream_vibe');
  const [corrY, setCorrY] = useState<MetricKey>('rating');
  const [chartView, setChartView] = useState<'days' | 'months'>('days');

  useEffect(() => {
    allAnswers(db).then(setRows);
  }, [db, version]);

  const metric = metricByKey(metricKey);
  const firstYear = rows.length ? fromKey(rows[0].date).getFullYear() : thisYear;

  // All values of the selected metric, all years.
  const allPoints = useMemo(
    () =>
      rows
        .filter((r) => r[metricKey] != null)
        .map((r) => ({ date: r.date, value: r[metricKey] as number, month: monthId(r.date) })),
    [rows, metricKey],
  );
  const points = allPoints.filter((p) => p.date.startsWith(`${year}-`));

  const byMonth = useMemo(() => {
    const groups = new Map<MonthId, number[]>();
    allPoints.forEach((p) => {
      if (!groups.has(p.month)) groups.set(p.month, []);
      groups.get(p.month)!.push(p.value);
    });
    return groups;
  }, [allPoints]);
  const monthsWithData = [...byMonth.keys()].sort((a, b) => a - b);
  const yearMonths = Array.from({ length: 12 }, (_, i) => byMonth.get(year * 12 + i) ?? []);

  // Default comparison: the two most recent months with data.
  useEffect(() => {
    const m = monthsWithData;
    setMonthB(m.length ? m[m.length - 1] : null);
    setMonthA(m.length > 1 ? m[m.length - 2] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey, monthsWithData.length]);

  const yearAvg = points.length ? mean(points.map((p) => p.value)) : null;
  const bestMonthIdx = yearMonths.reduce<number | null>(
    (best, g, i) => (g.length && (best == null || mean(g) > mean(yearMonths[best])) ? i : best),
    null,
  );
  const test =
    monthA != null && monthB != null && monthA !== monthB
      ? welchTTest(byMonth.get(monthA) ?? [], byMonth.get(monthB) ?? [])
      : null;

  // Correlation (all time): pairs of two metrics recorded on the same date.
  const xMetric = metricByKey(corrX);
  const yMetric = metricByKey(corrY);
  const pairs = rows
    .filter((r) => r[corrX] != null && r[corrY] != null)
    .map((r) => ({ x: r[corrX] as number, y: r[corrY] as number }));
  const corr = corrX !== corrY ? pearson(pairs.map((p) => p.x), pairs.map((p) => p.y)) : null;

  // --- chart geometry ---
  const plotW = chartW - PAD_L;
  const plotH = CHART_H - PAD_B - PAD_T;
  const yScale = (m: Metric) => (v: number) => PAD_T + plotH - ((v - m.min) / (m.max - m.min)) * plotH;
  const y = yScale(metric);
  const ticks = (m: Metric) => (m.max === 16 ? [0, 4, 8, 12, 16] : [1, 4, 7, 10]);
  const isLeap = new Date(year, 1, 29).getMonth() === 1;
  const daysInYear = isLeap ? 366 : 365;
  const dayOfYear = (key: string) =>
    Math.round((fromKey(key).getTime() - new Date(year, 0, 1).getTime()) / 86400000);
  const xDay = (doy: number) => PAD_L + (doy / (daysInYear - 1)) * plotW;
  const ma = movingAverage(points.map((p) => p.value), 7);
  const maPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xDay(dayOfYear(p.date)).toFixed(1)},${y(ma[i]).toFixed(1)}`)
    .join(' ');
  const barSlot = plotW / 12;

  const grid = (m: Metric, yy: (v: number) => number, x0 = PAD_L) =>
    ticks(m).map((v) => (
      <G key={v}>
        <Line x1={x0} x2={chartW} y1={yy(v)} y2={yy(v)} stroke={colors.border} strokeWidth={1} />
        <SvgText x={x0 - 6} y={yy(v) + 4} fontSize={10} fill={colors.muted} textAnchor="end">
          {v}
        </SvgText>
      </G>
    ));
  const monthLabels = (xFor: (m: number) => number) =>
    MONTHS.map((m, i) => (
      <SvgText key={m} x={xFor(i)} y={CHART_H - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
        {m[0]}
      </SvgText>
    ));

  // Scatter geometry for the correlation chart.
  const sx = (v: number) => PAD_L + ((v - xMetric.min) / (xMetric.max - xMetric.min)) * plotW;
  const sy = yScale(yMetric);
  const jitter = (i: number) => ((i * 37) % 7) / 7 - 0.5; // deterministic small offset so equal points stay visible

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Statistics</Text>
        <View style={styles.yearNav}>
          <Pressable onPress={() => setYear(year - 1)} hitSlop={12} disabled={year <= firstYear}>
            <View style={year <= firstYear && { opacity: 0.25 }}><Icon name="chevronLeft" size={20} color={colors.primary} /></View>
          </Pressable>
          <Text style={styles.year}>{year}</Text>
          <Pressable onPress={() => setYear(year + 1)} hitSlop={12} disabled={year >= thisYear}>
            <View style={year >= thisYear && { opacity: 0.25 }}><Icon name="chevronRight" size={20} color={colors.primary} /></View>
          </Pressable>
        </View>
      </View>

      <MetricChips value={metricKey} onChange={setMetricKey} />
      <View style={[styles.questionBox, { borderLeftColor: metric.color }]}>
        <Text style={styles.question}>"{metric.question}"</Text>
        <Text style={styles.questionScale}>
          {metric.unit ? `${metric.min}–${metric.max} hours` : `Scale ${metric.min}–${metric.max}`}
        </Text>
      </View>

      <View style={styles.tiles}>
        <Tile label="Answers" value={String(points.length)} />
        <Tile label="Average" value={yearAvg != null ? fmtVal(metric, yearAvg) : '–'} />
        <Tile label="Best month" value={bestMonthIdx != null ? `${MONTHS[bestMonthIdx]} ${year}` : '–'} />
      </View>

      {points.length === 0 ? (
        <Card>
          <Text style={styles.muted}>No answers in {year} yet.</Text>
        </Card>
      ) : (
        <Card>
          <View style={styles.segment}>
            {(['days', 'months'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setChartView(v)}
                style={[styles.segmentBtn, chartView === v && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, chartView === v && { color: colors.text }]}>
                  {v === 'days' ? 'Day by day' : 'Monthly average'}
                </Text>
              </Pressable>
            ))}
          </View>
          {chartView === 'days' ? (
          <>
            <Svg width={chartW} height={CHART_H}>
              {grid(metric, y)}
              {points.map((p) => (
                <Circle key={p.date} cx={xDay(dayOfYear(p.date))} cy={y(p.value)} r={2.5} fill={metric.color} opacity={0.35} />
              ))}
              {points.length > 1 ? <Path d={maPath} stroke={metric.color} strokeWidth={2.5} fill="none" /> : null}
              {monthLabels((m) => xDay(dayOfYear(`${year}-${String(m + 1).padStart(2, '0')}-15`)))}
            </Svg>
            <Text style={styles.caption}>Dots = single days, line = 7-entry average.</Text>
          </>
          ) : (
          <>
            <Svg width={chartW} height={CHART_H}>
              {grid(metric, y)}
              {yearMonths.map((g, i) => {
                if (!g.length) return null;
                const m = mean(g);
                const se = g.length > 1 ? Math.sqrt(variance(g) / g.length) : 0;
                const cx = PAD_L + barSlot * i + barSlot / 2;
                const bw = barSlot * 0.6;
                const id = year * 12 + i;
                const highlighted = id === monthA || id === monthB;
                return (
                  <G key={i}>
                    <Rect
                      x={cx - bw / 2}
                      y={y(m)}
                      width={bw}
                      height={y(metric.min) - y(m) + 0.01}
                      rx={3}
                      fill={metric.color}
                      opacity={highlighted ? 1 : 0.45}
                    />
                    {se > 0 ? (
                      <Line
                        x1={cx}
                        x2={cx}
                        y1={y(Math.min(metric.max, m + se))}
                        y2={y(Math.max(metric.min, m - se))}
                        stroke={colors.text}
                        strokeWidth={1}
                      />
                    ) : null}
                  </G>
                );
              })}
              {monthLabels((m) => PAD_L + barSlot * m + barSlot / 2)}
            </Svg>
            <Text style={styles.caption}>Whiskers = ± standard error.</Text>
          </>
          )}
        </Card>
      )}

      {monthsWithData.length > 0 ? (
        <Card title="Compare two months">
          <MonthPicker label="A" value={monthA} months={monthsWithData} onChange={setMonthA} />
          <MonthPicker label="B" value={monthB} months={monthsWithData} onChange={setMonthB} />
          <ComparisonResult
            metric={metric}
            test={test}
            monthA={monthA}
            monthB={monthB}
            nA={monthA != null ? (byMonth.get(monthA)?.length ?? 0) : 0}
            nB={monthB != null ? (byMonth.get(monthB)?.length ?? 0) : 0}
          />
        </Card>
      ) : null}

      <Card title="Correlation (all years)">
        <View style={styles.inlinePicker}>
          <Text style={styles.inlineLabel}>→</Text>
          <MetricChips value={corrX} onChange={setCorrX} small />
        </View>
        <View style={styles.inlinePicker}>
          <Text style={styles.inlineLabel}>↑</Text>
          <MetricChips value={corrY} onChange={setCorrY} small />
        </View>
        {corrX === corrY ? (
          <Text style={styles.muted}>Pick two different questions.</Text>
        ) : pairs.length < 3 ? (
          <Text style={styles.muted}>
            Need at least 3 days where both "{xMetric.long}" and "{yMetric.long}" are answered (have {pairs.length}).
          </Text>
        ) : (
          <>
            <Svg width={chartW} height={CHART_H} style={{ marginTop: 8 }}>
              {grid(yMetric, sy)}
              {pairs.map((p, i) => (
                <Circle
                  key={i}
                  cx={sx(p.x) + jitter(i) * 4}
                  cy={sy(p.y) + jitter(i + 3) * 4}
                  r={4}
                  fill={xMetric.color}
                  opacity={0.55}
                />
              ))}
              {ticks(xMetric).map((v) => (
                <SvgText key={v} x={sx(v)} y={CHART_H - 6} fontSize={10} fill={colors.muted} textAnchor="middle">
                  {v}
                </SvgText>
              ))}
            </Svg>
            <Text style={styles.axisLabel}>
              → {xMetric.long} · ↑ {yMetric.long}
            </Text>
            {corr ? (
              <View style={styles.result}>
                <Text style={styles.resultMean}>r = {corr.r.toFixed(2)}</Text>
                <Text style={[styles.verdict, { color: corr.p < 0.05 ? colors.success : colors.muted }]}>
                  {corr.p < 0.05
                    ? `Significant: ${describeR(corr.r)} (${pText(corr.p)}).`
                    : `Not significant: ${describeR(corr.r)} so far (${pText(corr.p)}).`}
                </Text>
                <Text style={styles.caption}>
                  Pearson, {corr.n} days, t = {corr.t.toFixed(2)}, df = {corr.df}.
                </Text>
              </View>
            ) : (
              <Text style={styles.muted}>One of the two has no variation yet, so no correlation can be computed.</Text>
            )}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function MetricChips({
  value,
  onChange,
  small,
}: {
  value: MetricKey;
  onChange: (k: MetricKey) => void;
  small?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: small ? 6 : 10, flexGrow: 0, flexShrink: 1 }}>
      {METRICS.map((m) => (
        <Pressable
          key={m.key}
          onPress={() => onChange(m.key)}
          style={[
            styles.chip,
            small && styles.chipSmall,
            value === m.key && { backgroundColor: m.color, borderColor: m.color },
          ]}
        >
          <Text style={[styles.chipText, value === m.key && { color: '#fff' }]}>{m.short}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
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
  value: MonthId | null;
  months: MonthId[];
  onChange: (m: MonthId) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={[styles.inlinePicker, { marginBottom: 8 }]}>
      <Text style={[styles.inlineLabel, { marginBottom: 0 }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
        {months.map((m) => (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[styles.monthChip, value === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={[styles.chipText, value === m && { color: '#fff' }]}>{monthName(m)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ComparisonResult({
  metric,
  test,
  monthA,
  monthB,
  nA,
  nB,
}: {
  metric: Metric;
  test: ReturnType<typeof welchTTest>;
  monthA: MonthId | null;
  monthB: MonthId | null;
  nA: number;
  nB: number;
}) {
  const styles = useStyles();
  const colors = useColors();
  if (monthA == null || monthB == null) {
    return <Text style={styles.muted}>You need answers in at least two months to compare.</Text>;
  }
  if (monthA === monthB) return <Text style={styles.muted}>Pick two different months.</Text>;
  if (!test) {
    return (
      <Text style={styles.muted}>
        Need at least 2 answers in each month (have {nA} in {monthName(monthA)}, {nB} in {monthName(monthB)}).
      </Text>
    );
  }
  const diff = test.meanB - test.meanA;
  const significant = test.p < 0.05;
  return (
    <View style={styles.result}>
      <View style={styles.resultRow}>
        <View style={styles.resultCol}>
          <Text style={styles.resultMonth}>{monthName(monthA)}</Text>
          <Text style={styles.resultMean}>{test.meanA.toFixed(2)}</Text>
          <Text style={styles.muted}>n = {test.nA}</Text>
        </View>
        <Text style={styles.vs}>vs</Text>
        <View style={styles.resultCol}>
          <Text style={styles.resultMonth}>{monthName(monthB)}</Text>
          <Text style={styles.resultMean}>{test.meanB.toFixed(2)}</Text>
          <Text style={styles.muted}>n = {test.nB}</Text>
        </View>
      </View>
      <Text style={[styles.verdict, { color: significant ? colors.success : colors.muted }]}>
        {significant
          ? `${metric.long} in ${monthName(monthB)} was significantly ${diff > 0 ? 'higher' : 'lower'} (${pText(test.p)}).`
          : `No significant difference (${pText(test.p)}).`}
      </Text>
      <Text style={styles.caption}>
        Welch's t-test: t = {test.t.toFixed(2)}, df = {test.df.toFixed(1)}, d = {test.d.toFixed(2)}. Significant = p {'<'} 0.05.
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 30, fontWeight: '800', color: colors.text },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  questionBox: { borderLeftWidth: 4, paddingLeft: 10, paddingVertical: 2, marginBottom: 14 },
  question: { fontSize: 15, fontStyle: 'italic', color: colors.text },
  questionScale: { fontSize: 12, color: colors.muted, marginTop: 2 },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 3, marginBottom: 10 },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontWeight: '600', color: colors.muted, fontSize: 13 },
  inlinePicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineLabel: { width: 18, fontSize: 16, color: colors.muted, fontWeight: '700', marginBottom: 6 },
  yearNav: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  arrow: { fontSize: 30, color: colors.primary },
  year: { fontSize: 20, fontWeight: '700', color: colors.text },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: colors.text, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, alignItems: 'center' },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  caption: { color: colors.muted, fontSize: 12, marginTop: 8 },
  axisLabel: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  muted: { color: colors.muted },
  pickerLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 6 },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
    backgroundColor: colors.card,
  },
  result: { marginTop: 8, padding: 12, backgroundColor: colors.bg, borderRadius: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  resultCol: { alignItems: 'center' },
  resultMonth: { fontWeight: '700', color: colors.text },
  resultMean: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  vs: { color: colors.muted, fontWeight: '700' },
  verdict: { marginTop: 10, fontWeight: '700', textAlign: 'center' },
}));
