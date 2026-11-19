import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { formatHours } from '../components/HoursStepper';
import { Icon } from '../components/Icon';
import { useDataVersion } from '../dataVersion';
import { fromKey, MONTHS, todayKey } from '../dates';
import { isDayDone, listEntries, type EntrySummary } from '../db';
import { scoreColor } from '../questions';
import { makeStyles, radius, useColors } from '../theme';

export function ListScreen({ onOpen }: { onOpen: (date: string) => void }) {
  const db = useSQLiteContext();
  const styles = useStyles();
  const colors = useColors();
  const { version } = useDataVersion();
  const [entries, setEntries] = useState<EntrySummary[]>([]);

  useEffect(() => {
    listEntries(db).then(setEntries);
  }, [db, version]);

  const today = todayKey();
  const todayEntry = entries.find((e) => e.date === today);
  const todayDone = todayEntry ? isDayDone(todayEntry, todayEntry.day_memos) : false;

  // Group entries by month: "November 2026".
  const sections = useMemo(() => {
    const out: { title: string; data: EntrySummary[] }[] = [];
    for (const e of entries) {
      const d = fromKey(e.date);
      const title = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!out.length || out[out.length - 1].title !== title) out.push({ title, data: [] });
      out[out.length - 1].data.push(e);
    }
    return out;
  }, [entries]);

  const header = (
    <View>
      <Text style={styles.h1}>Journal</Text>
      {todayDone ? (
        <Pressable style={[styles.hero, styles.heroDone]} onPress={() => onOpen(today)}>
          <View style={styles.heroIconDone}>
            <Icon name="check" size={22} color={colors.success} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.success }]}>Done for today</Text>
            <Text style={[styles.heroSub, { color: colors.success }]}>Tap to add more</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable style={styles.hero} onPress={() => onOpen(today)}>
          <View style={styles.heroIcon}>
            <Icon name="mic" size={22} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{todayEntry ? "Continue today's entry" : 'How was today?'}</Text>
            <Text style={styles.heroSub}>{todayEntry ? missingText(todayEntry) : 'Record a memo and answer a few questions'}</Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.onPrimary} />
        </Pressable>
      )}
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.date}
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>Your entries will show up here.</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item, index, section }) => {
        const d = fromKey(item.date);
        const done = isDayDone(item, item.day_memos);
        const details = [
          item.growth != null ? `Growth ${item.growth}` : null,
          item.social === 1 ? 'Social' : null,
          item.sleep_hours != null ? `${formatHours(item.sleep_hours)} h sleep` : null,
          item.dream_vibe != null ? `Dream ${item.dream_vibe}` : null,
        ].filter(Boolean);
        const first = index === 0;
        const last = index === section.data.length - 1;
        return (
          <Pressable
            onPress={() => onOpen(item.date)}
            style={({ pressed }) => [
              styles.row,
              first && styles.rowFirst,
              last && styles.rowLast,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.dateCol}>
              <Text style={styles.dayNum}>{d.getDate()}</Text>
              <Text style={styles.weekday}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.rowTitle}>{item.date === today ? 'Today' : rowTitle(item)}</Text>
                {done ? <Icon name="check" size={16} color={colors.success} strokeWidth={2.5} /> : null}
              </View>
              <Text style={styles.rowSub} numberOfLines={1}>
                {[
                  item.day_memos ? `🎙 ${item.day_memos}` : null,
                  item.dream_memos ? `🌙 ${item.dream_memos}` : null,
                  ...details,
                ]
                  .filter(Boolean)
                  .join('  ·  ') || 'Nothing answered yet'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: item.rating == null ? colors.border : scoreColor(item.rating) }]}>
              <Text style={[styles.badgeText, item.rating == null && { color: colors.muted }]}>
                {item.rating ?? '–'}
              </Text>
            </View>
            {!last ? <View style={styles.separator} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

function rowTitle(e: EntrySummary): string {
  if (e.rating == null) return 'Entry';
  if (e.rating >= 8) return 'Great day';
  if (e.rating >= 6) return 'Good day';
  if (e.rating >= 4) return 'Okay day';
  return 'Tough day';
}

function missingText(e: EntrySummary): string {
  const missing: string[] = [];
  if (e.day_memos === 0) missing.push('memo');
  if (e.rating == null || e.growth == null || e.social == null) missing.push('survey');
  return missing.length ? `Still missing: ${missing.join(' and ')}` : '';
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    content: { padding: 16, paddingBottom: 32 },
    h1: { fontSize: 30, fontWeight: '800', color: c.text, marginBottom: 18, marginTop: 4 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.primary,
      borderRadius: radius,
      padding: 18,
      marginBottom: 8,
    },
    heroDone: { backgroundColor: c.successSoft },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroIconDone: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { color: c.onPrimary, fontSize: 18, fontWeight: '800' },
    heroSub: { color: c.onPrimary, opacity: 0.85, marginTop: 2, fontSize: 13 },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 22,
      marginBottom: 8,
      marginLeft: 4,
    },
    empty: { color: c.muted, textAlign: 'center', marginTop: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.card,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    rowFirst: { borderTopLeftRadius: radius, borderTopRightRadius: radius },
    rowLast: { borderBottomLeftRadius: radius, borderBottomRightRadius: radius },
    separator: {
      position: 'absolute',
      left: 66,
      right: 0,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    dateCol: { width: 38, alignItems: 'center' },
    dayNum: { fontSize: 20, fontWeight: '800', color: c.text },
    weekday: { fontSize: 11, color: c.muted, fontWeight: '600', textTransform: 'uppercase' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowTitle: { fontWeight: '700', color: c.text, fontSize: 15 },
    rowSub: { color: c.muted, fontSize: 12, marginTop: 3 },
    badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  }),
);
