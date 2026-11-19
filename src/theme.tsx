import { useSQLiteContext } from 'expo-sqlite';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from './db';

export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  dream: string;
  dreamSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  record: string;
  shadow: string;
};

const light: Palette = {
  bg: '#F4F5F9',
  card: '#FFFFFF',
  cardAlt: '#F7F8FB',
  text: '#1C1F2B',
  muted: '#6B7180',
  faint: '#A3A8B5',
  border: '#E6E8EE',
  primary: '#4F6DF5',
  primarySoft: '#E9EDFE',
  onPrimary: '#FFFFFF',
  dream: '#7C4DDB',
  dreamSoft: '#F2ECFD',
  success: '#0E9F6E',
  successSoft: '#E4F7EE',
  danger: '#E5484D',
  record: '#E5484D',
  shadow: '#000000',
};

const dark: Palette = {
  bg: '#0E1016',
  card: '#181B24',
  cardAlt: '#1F2330',
  text: '#ECEEF4',
  muted: '#9AA0AE',
  faint: '#5D6372',
  border: '#2A2E3B',
  primary: '#7D93FF',
  primarySoft: '#232A48',
  onPrimary: '#FFFFFF',
  dream: '#A98BF2',
  dreamSoft: '#231C37',
  success: '#3DD598',
  successSoft: '#123024',
  danger: '#FF6B6F',
  record: '#FF5A5F',
  shadow: '#000000',
};

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeValue {
  colors: Palette;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeCtx = createContext<ThemeValue>({
  colors: light,
  scheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

/** Must be rendered inside <SQLiteProvider>, the preference is stored in the settings table. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    getSetting(db, 'theme').then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
    });
  }, [db]);

  const scheme: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const colors = scheme === 'dark' ? dark : light;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const value = useMemo<ThemeValue>(
    () => ({
      colors,
      scheme,
      preference,
      setPreference: (p) => {
        setPref(p);
        setSetting(db, 'theme', p).catch(() => {});
      },
    }),
    [colors, scheme, preference, db],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
export const useColors = () => useContext(ThemeCtx).colors;

/** Create a hook that builds (and caches) a stylesheet for the current palette. */
export function makeStyles<T>(factory: (c: Palette) => T): () => T {
  const cache = new WeakMap<Palette, T>();
  return () => {
    const c = useColors();
    let s = cache.get(c);
    if (!s) {
      s = factory(c);
      cache.set(c, s);
    }
    return s;
  };
}

export const radius = 18;

/** Soft card shadow that works in both themes. */
export const shadow = (c: Palette) => ({
  shadowColor: c.shadow,
  shadowOpacity: c === dark ? 0 : 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: c === dark ? 0 : 2,
});
