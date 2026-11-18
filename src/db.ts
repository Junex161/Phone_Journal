import type { SQLiteDatabase } from 'expo-sqlite';
import type { QuestionKey } from './questions';

export type MemoKind = 'day' | 'dream';

export interface Entry {
  date: string;
  rating: number | null;
  energy: number | null;
  sleep: number | null;
}

export interface Memo {
  id: number;
  date: string;
  kind: MemoKind;
  file: string;
  duration_ms: number;
  created_at: string;
}

export interface EntrySummary extends Entry {
  day_memos: number;
  dream_memos: number;
}

export const DB_NAME = 'journal.db';

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS entries (
        date TEXT PRIMARY KEY NOT NULL,
        rating INTEGER,
        energy INTEGER,
        sleep INTEGER,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        kind TEXT NOT NULL,
        file TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS memos_date ON memos(date);
    `);
    version = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

export async function getEntry(db: SQLiteDatabase, date: string): Promise<Entry> {
  const row = await db.getFirstAsync<Entry>(
    'SELECT date, rating, energy, sleep FROM entries WHERE date = ?',
    date,
  );
  return row ?? { date, rating: null, energy: null, sleep: null };
}

export async function setAnswer(
  db: SQLiteDatabase,
  date: string,
  key: QuestionKey,
  value: number | null,
): Promise<void> {
  // key is from a fixed whitelist (QuestionKey), safe to interpolate as a column name.
  const col = ({ rating: 'rating', energy: 'energy', sleep: 'sleep' } as const)[key];
  await db.runAsync(
    `INSERT INTO entries (date, ${col}, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET ${col} = excluded.${col}, updated_at = excluded.updated_at`,
    date,
    value,
    new Date().toISOString(),
  );
}

export async function getMemos(db: SQLiteDatabase, date: string): Promise<Memo[]> {
  return db.getAllAsync<Memo>('SELECT * FROM memos WHERE date = ? ORDER BY created_at', date);
}

export async function addMemo(
  db: SQLiteDatabase,
  date: string,
  kind: MemoKind,
  file: string,
  durationMs: number,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO memos (date, kind, file, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)',
    date,
    kind,
    file,
    Math.round(durationMs),
    new Date().toISOString(),
  );
}

export async function deleteMemo(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM memos WHERE id = ?', id);
}

/** All days that have answers or memos, newest first. */
export async function listEntries(db: SQLiteDatabase): Promise<EntrySummary[]> {
  return db.getAllAsync<EntrySummary>(`
    WITH days AS (
      SELECT date FROM entries
      WHERE rating IS NOT NULL OR energy IS NOT NULL OR sleep IS NOT NULL
      UNION SELECT date FROM memos
    )
    SELECT d.date AS date, e.rating AS rating, e.energy AS energy, e.sleep AS sleep,
      (SELECT COUNT(*) FROM memos m WHERE m.date = d.date AND m.kind = 'day') AS day_memos,
      (SELECT COUNT(*) FROM memos m WHERE m.date = d.date AND m.kind = 'dream') AS dream_memos
    FROM days d LEFT JOIN entries e ON e.date = d.date
    ORDER BY d.date DESC
  `);
}

/** Questionnaire answers within [from, to] (inclusive), oldest first. */
export async function answersBetween(db: SQLiteDatabase, from: string, to: string): Promise<Entry[]> {
  return db.getAllAsync<Entry>(
    `SELECT date, rating, energy, sleep FROM entries
     WHERE date BETWEEN ? AND ? ORDER BY date`,
    from,
    to,
  );
}
