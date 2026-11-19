import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from './src/components/Icon';
import { SwipeTabs } from './src/components/SwipeTabs';
import { DataVersionProvider } from './src/dataVersion';
import { DB_NAME, migrate } from './src/db';
import { recordingGuard } from './src/recordingGuard';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { EntryScreen } from './src/screens/EntryScreen';
import { ListScreen } from './src/screens/ListScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { makeStyles, ThemeProvider, useTheme } from './src/theme';

type Tab = 'list' | 'calendar' | 'stats' | 'settings';

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'list', label: 'Journal', icon: 'journal' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'stats', label: 'Stats', icon: 'stats' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <ThemeProvider>
          <DataVersionProvider>
            <Main />
          </DataVersionProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function Main() {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
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
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {openDate ? (
        <EntryScreen key={openDate} date={openDate} onChangeDate={setOpenDate} onClose={() => setOpenDate(null)} />
      ) : (
        <>
          <View style={styles.content}>
            <SwipeTabs
              index={TABS.findIndex((t) => t.key === tab)}
              count={TABS.length}
              onChange={(i) => setTab(TABS[i].key)}
            >
              {tab === 'list' && <ListScreen onOpen={setOpenDate} />}
              {tab === 'calendar' && <CalendarScreen onOpen={setOpenDate} />}
              {tab === 'stats' && <StatsScreen />}
              {tab === 'settings' && <SettingsScreen />}
            </SwipeTabs>
          </View>
          <View style={styles.tabBar}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)} accessibilityLabel={t.label}>
                  <View style={[styles.iconPill, active && { backgroundColor: colors.primarySoft }]}>
                    <Icon name={t.icon} size={22} color={active ? colors.primary : colors.muted} />
                  </View>
                  <Text style={[styles.tabLabel, active && { color: colors.primary }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: { flex: 1, overflow: 'hidden' },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.card,
      paddingTop: 8,
      paddingBottom: 6,
    },
    tab: { flex: 1, alignItems: 'center' },
    iconPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    tabLabel: { fontSize: 11, color: c.muted, fontWeight: '600', marginTop: 3 },
  }),
);
