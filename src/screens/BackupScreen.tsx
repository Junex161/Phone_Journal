import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { exportBackup, exportPdf, pickAndImportBackup } from '../backup';
import { Card } from '../components/Card';
import { useDataVersion } from '../dataVersion';
import { colors } from '../theme';

export function BackupScreen() {
  const db = useSQLiteContext();
  const { bump } = useDataVersion();
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
      <Text style={styles.h1}>Backup</Text>

      <Card title="Full backup (.zip)">
        <Text style={styles.text}>
          All entries, survey answers and voice memos in one file. Save it to Google Drive, send it to yourself, or copy
          it to your PC. If your phone dies, install the app on a new phone and use "Import backup".
        </Text>
        <Button label="Export backup" onPress={doBackup} busy={busy === 'backup'} disabled={!!busy} />
      </Card>

      <Card title="Readable PDF">
        <Text style={styles.text}>All entries and survey answers as a PDF to read or print. Voice memos can't go into a PDF.</Text>
        <Button label="Export PDF" onPress={doPdf} busy={busy === 'pdf'} disabled={!!busy} color={colors.dream} />
      </Card>

      <Card title="Restore">
        <Text style={styles.text}>Load a backup .zip that was exported from this app.</Text>
        <Button label="Import backup" onPress={doImport} busy={busy === 'import'} disabled={!!busy} outline />
      </Card>
    </ScrollView>
  );
}

function Button({
  label,
  onPress,
  busy,
  disabled,
  color = colors.primary,
  outline,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  color?: string;
  outline?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        outline ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color },
        disabled && !busy && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? color : '#fff'} />
      ) : (
        <Text style={[styles.btnText, outline && { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  h1: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: 16 },
  text: { color: colors.muted, marginBottom: 12, lineHeight: 20 },
  btn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
