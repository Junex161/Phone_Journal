import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DataVersionProvider } from './src/dataVersion';
import { DB_NAME, migrate } from './src/db';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { EntryScreen } from './src/screens/EntryScreen';
import { ListScreen } from './src/screens/ListScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { BackupScreen } from './src/screens/BackupScreen';
import { recordingGuard } from './src/recordingGuard';
import { SwipeTabs } from './src/components/SwipeTabs';
import { colors } from './src/theme';

type Tab = 'list' | 'calendar' | 'stats' | 'backup';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'list', label: 'Journal', icon: '📖' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'stats', label: 'Stats', icon: '📈' },
  { key: 'backup', label: 'Backup', icon: '💾' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <DataVersionProvider>
          <Main />
        </DataVersionProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function Main() {
  const [tab, setTab] = useState<Tab>('list');
  const [openDate, setOpenDate] = useState<string | null>(null);

  // Android back button closes an open entry instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (recordingGuard.active) {
        Alert.alert('Recording in progress', 'Stop the recording first.');
        return true;
      }
      if (openDate) {
        setOpenDate(null);
        return true;
      }
      if (tab !== 'list') {
        setTab('list');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [openDate, tab]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {openDate ? (
        <EntryScreen key={openDate} date={openDate} onChangeDate={setOpenDate} onClose={() => setOpenDate(null)} />
      ) : (
        <>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <SwipeTabs
              index={TABS.findIndex((t) => t.key === tab)}
              count={TABS.length}
              onChange={(i) => setTab(TABS[i].key)}
            >
              {tab === 'list' && <ListScreen onOpen={setOpenDate} />}
              {tab === 'calendar' && <CalendarScreen onOpen={setOpenDate} />}
              {tab === 'stats' && <StatsScreen />}
              {tab === 'backup' && <BackupScreen />}
            </SwipeTabs>
          </View>
          <View style={styles.tabBar}>
            {TABS.map((t) => (
              <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabIcon, tab !== t.key && styles.inactive]}>{t.icon}</Text>
                <Text style={[styles.tabLabel, tab === t.key && { color: colors.primary }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 22 },
  inactive: { opacity: 0.45 },
  tabLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 2 },
});
