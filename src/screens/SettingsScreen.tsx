import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { exportBackup, exportPdf, pickAndImportBackup } from '../backup';
import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { useDataVersion } from '../dataVersion';
import { makeStyles, useTheme, type ThemePreference } from '../theme';

const THEME_OPTIONS: { key: ThemePreference; label: string; icon: IconName | null }[] = [
  { key: 'system', label: 'Phone', icon: null },
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Night', icon: 'moon' },
];

export function SettingsScreen() {
  const db = useSQLiteContext();
  const { bump } = useDataVersion();
  const { colors, preference, setPreference } = useTheme();
  const styles = useStyles();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const doBackup = () =>
    run('backup', async () => {
      const r = await exportBackup(db);
      if (r.missing) {
        Alert.alert('Backup created', `${r.missing} memo file(s) were missing on the phone and could not be included.`);
      }
    });

  const doPdf = () => run('pdf', () => exportPdf(db));

  const doImport = () =>
    Alert.alert(
      'Import backup?',
      'Entries from the backup are merged into this journal. Survey answers for the same day are replaced by the backup. Memos you already have are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          onPress: () =>
            run('import', async () => {
              const r = await pickAndImportBackup(db);
              if (!r) return;
              bump();
              Alert.alert(
                'Import finished',
                `${r.entries} days and ${r.memosAdded} memos imported${r.memosSkipped ? ` (${r.memosSkipped} memos were already there)` : ''}.`,
              );
            }),
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Settings</Text>

      <Card title="Appearance">
        <View style={styles.segment}>
          {THEME_OPTIONS.map((o) => {
            const on = preference === o.key;
            return (
              <Pressable key={o.key} onPress={() => setPreference(o.key)} style={[styles.segBtn, on && styles.segOn]}>
                {o.icon ? <Icon name={o.icon} size={18} color={on ? colors.primary : colors.muted} /> : null}
                <Text style={[styles.segText, on && { color: colors.primary }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>"Phone" follows your phone's light/dark setting.</Text>
      </Card>

      <Card title="Backup">
        <Row
          title="Export backup"
          text="All entries, voice memos and survey.csv (one row per day) in one .zip. Restore it with Import."
          onPress={doBackup}
          busy={busy === 'backup'}
          disabled={!!busy}
        />
        <View style={styles.divider} />
        <Row
          title="Export PDF"
          text="All entries and answers to read or print."
          onPress={doPdf}
          busy={busy === 'pdf'}
          disabled={!!busy}
        />
        <View style={styles.divider} />
        <Row
          title="Import backup"
          text="Load a .zip exported from this app, e.g. on a new phone."
          onPress={doImport}
          busy={busy === 'import'}
          disabled={!!busy}
        />
      </Card>
    </ScrollView>
  );
}

function Row({
  title,
  text,
  onPress,
  busy,
  disabled,
}: {
  title: string;
  text: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowText}>{text}</Text>
      </View>
      {busy ? <ActivityIndicator color={colors.primary} /> : <Icon name="chevronRight" size={20} color={colors.faint} />}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    content: { padding: 16, paddingBottom: 32 },
    h1: { fontSize: 30, fontWeight: '800', color: c.text, marginBottom: 18, marginTop: 4 },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.cardAlt,
      borderRadius: 14,
      padding: 3,
      borderWidth: 1,
      borderColor: c.border,
    },
    segBtn: {
      flex: 1,
      height: 40,
      borderRadius: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    segOn: { backgroundColor: c.primarySoft },
    segText: { fontWeight: '700', color: c.muted },
    hint: { color: c.faint, fontSize: 12, marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    rowTitle: { color: c.text, fontWeight: '700', fontSize: 16 },
    rowText: { color: c.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 10 },
  }),
);
