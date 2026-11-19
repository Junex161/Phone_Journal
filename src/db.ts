import type { SQLiteDatabase } from 'expo-sqlite';

export type MemoKind = 'day' | 'dream';

export interface Entry {
  date: string;
  // Day survey
  rating: number | null;
  growth: number | null;
  social: number | null; // 1 = yes, 0 = no
  social_with: string | null; // comma-separated
  social_note: string | null;
  // Sleep & dream survey (night before this date)
  sleep_hours: number | null;
  dream_vibe: number | null;
  rested: number | null;
}

export type EntryField = Exclude<keyof Entry, 'date'>;

export const ENTRY_FIELDS: EntryField[] = [
  'rating',
  'growth',
  'social',
  'social_with',
  'social_note',
  'sleep_hours',
  'dream_vibe',
  'rested',
];

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

export function emptyEntry(date: string): Entry {
  return {
    date,
    rating: null,
    growth: null,
    social: null,
    social_with: null,
    social_note: null,
    sleep_hours: null,
    dream_vibe: null,
    rested: null,
  };
}

/** A day counts as done when there is a day memo and all three day questions are answered. */
export function isDayDone(e: Entry, dayMemos: number): boolean {
  return dayMemos > 0 && e.rating != null && e.growth != null && e.social != null;
}

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
  if (version < 2) {
    // v0.2: two daily surveys. Old "sleep quality" becomes "rested"; energy is no longer used.
    // One transaction, including the version bump, so a crash can't leave it half-migrated.
    await db.execAsync(`
      BEGIN;
      ALTER TABLE entries ADD COLUMN growth INTEGER;
      ALTER TABLE entries ADD COLUMN social INTEGER;
      ALTER TABLE entries ADD COLUMN social_with TEXT;
      ALTER TABLE entries ADD COLUMN social_note TEXT;
      ALTER TABLE entries ADD COLUMN sleep_hours REAL;
      ALTER TABLE entries ADD COLUMN dream_vibe INTEGER;
      ALTER TABLE entries ADD COLUMN rested INTEGER;
      UPDATE entries SET rested = sleep WHERE sleep IS NOT NULL;
      PRAGMA user_version = 2;
      COMMIT;
    `);
    version = 2;
  }
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

const SELECT_FIELDS = `date, ${ENTRY_FIELDS.join(', ')}`;
const ANY_ANSWER = ENTRY_FIELDS.map((f) => `${f} IS NOT NULL`).join(' OR ');

export async function getEntry(db: SQLiteDatabase, date: string): Promise<Entry> {
  const row = await db.getFirstAsync<Entry>(`SELECT ${SELECT_FIELDS} FROM entries WHERE date = ?`, date);
  return row ?? emptyEntry(date);
}

export async function setField(
  db: SQLiteDatabase,
  date: string,
  field: EntryField,
  value: number | string | null,
): Promise<void> {
  if (!ENTRY_FIELDS.includes(field)) throw new Error(`Unknown field ${field}`);
  // `field` is checked against a fixed whitelist above, so it is safe as a column name.
  await db.runAsync(
    `INSERT INTO entries (date, ${field}, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET ${field} = excluded.${field}, updated_at = excluded.updated_at`,
    date,
    value,
    new Date().toISOString(),
  );
}

/** Most recent sleep_hours before a date, used as the stepper's starting value. */
export async function lastSleepHours(db: SQLiteDatabase, before: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ sleep_hours: number }>(
    'SELECT sleep_hours FROM entries WHERE date < ? AND sleep_hours IS NOT NULL ORDER BY date DESC LIMIT 1',
    before,
  );
  return row?.sleep_hours ?? null;
}

export async function getMemos(db: SQLiteDatabase, date: string): Promise<Memo[]> {
  return db.getAllAsync<Memo>('SELECT * FROM memos WHERE date = ? ORDER BY created_at', date);
}

export async function allMemos(db: SQLiteDatabase): Promise<Memo[]> {
  return db.getAllAsync<Memo>('SELECT * FROM memos ORDER BY date, created_at');
}

export async function addMemo(
  db: SQLiteDatabase,
  date: string,
  kind: MemoKind,
  file: string,
  durationMs: number,
  createdAt = new Date().toISOString(),
): Promise<void> {
  await db.runAsync(
    'INSERT INTO memos (date, kind, file, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)',
    date,
    kind,
    file,
    Math.round(durationMs),
    createdAt,
  );
}

export async function memoFileExists(db: SQLiteDatabase, file: string): Promise<boolean> {
  return !!(await db.getFirstAsync('SELECT id FROM memos WHERE file = ?', file));
}

export async function deleteMemo(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM memos WHERE id = ?', id);
}

/** All days that have answers or memos, newest first. */
export async function listEntries(db: SQLiteDatabase): Promise<EntrySummary[]> {
  return db.getAllAsync<EntrySummary>(`
    WITH days AS (
      SELECT date FROM entries WHERE ${ANY_ANSWER}
      UNION SELECT date FROM memos
    )
    SELECT d.date AS date, ${ENTRY_FIELDS.map((f) => `e.${f} AS ${f}`).join(', ')},
      (SELECT COUNT(*) FROM memos m WHERE m.date = d.date AND m.kind = 'day') AS day_memos,
      (SELECT COUNT(*) FROM memos m WHERE m.date = d.date AND m.kind = 'dream') AS dream_memos
    FROM days d LEFT JOIN entries e ON e.date = d.date
    ORDER BY d.date DESC
  `);
}

/** All survey rows, oldest first. */
export async function allAnswers(db: SQLiteDatabase): Promise<Entry[]> {
  return db.getAllAsync<Entry>(`SELECT ${SELECT_FIELDS} FROM entries WHERE ${ANY_ANSWER} ORDER BY date`);
}

/** Insert or overwrite a whole entry (used by backup import). */
export async function upsertEntry(db: SQLiteDatabase, e: Entry): Promise<void> {
  const cols = ENTRY_FIELDS.join(', ');
  const qs = ENTRY_FIELDS.map(() => '?').join(', ');
  const updates = ENTRY_FIELDS.map((f) => `${f} = excluded.${f}`).join(', ');
  await db.runAsync(
    `INSERT INTO entries (date, ${cols}, updated_at) VALUES (?, ${qs}, ?)
     ON CONFLICT(date) DO UPDATE SET ${updates}, updated_at = excluded.updated_at`,
    e.date,
    ...ENTRY_FIELDS.map((f) => (e[f] === undefined ? null : e[f])),
    new Date().toISOString(),
  );
}
