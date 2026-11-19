import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { formatHours } from './components/HoursStepper';
import { formatDuration, formatLong, todayKey } from './dates';
import {
  addMemo,
  allAnswers,
  allMemos,
  ENTRY_FIELDS,
  memoFileExists,
  upsertEntry,
  type Entry,
  type Memo,
} from './db';
import { memoFile } from './memoFiles';
import { DAY_SCALES, SLEEP_SCALES } from './questions';

// Backup format: a .zip containing
//   journal.json   { app, format, exportedAt, entries: Entry[], memos: Memo[] }
//   memos/<file>   the audio files
// It can be restored with importBackup() and is also readable by anyone who unzips it.

const APP_ID = 'phone-journal';
const FORMAT = 1;

interface BackupJson {
  app: string;
  format: number;
  exportedAt: string;
  entries: Entry[];
  memos: Omit<Memo, 'id'>[];
}

async function share(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

export async function exportBackup(db: SQLiteDatabase): Promise<{ entries: number; memos: number; missing: number }> {
  const [entries, memos] = await Promise.all([allAnswers(db), allMemos(db)]);
  const files: Zippable = {};
  let missing = 0;
  for (const m of memos) {
    const f = memoFile(m.file);
    if (!f.exists) {
      missing++;
      continue;
    }
    // Audio is already compressed: store without re-compressing (level 0) to keep it fast.
    files[`memos/${m.file}`] = [f.bytesSync(), { level: 0 }];
  }
  const json: BackupJson = {
    app: APP_ID,
    format: FORMAT,
    exportedAt: new Date().toISOString(),
    entries,
    memos: memos.map(({ id: _id, ...rest }) => rest),
  };
  files['journal.json'] = strToU8(JSON.stringify(json, null, 2));
  files['survey.csv'] = strToU8(buildCsv(entries, memos));
  files['README.txt'] = strToU8(CSV_README);
  const zipped = zipSync(files);

  const out = new File(Paths.cache, `journal-backup-${todayKey()}.zip`);
  if (out.exists) out.delete();
  out.create();
  out.write(zipped);
  await share(out.uri, 'application/zip', 'Save journal backup');
  return { entries: entries.length, memos: memos.length - missing, missing };
}

// ---------------------------------------------------------------- CSV (one row per day)

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CSV_README = `Journal backup
==============

journal.json  Full backup (all answers + memo list). Use "Import backup" in the app to restore.
memos/        The voice memos (.m4a).
survey.csv    Survey answers, one row per day (comma-separated, UTF-8, missing values = NA).

survey.csv columns
------------------
date                 YYYY-MM-DD
weekday              Monday ... Sunday
day_rating           How was your day? (1-10)
social               Did you do something social today? (1 = yes, 0 = no)
social_with          With whom (separated by ";")
social_note          Free-text note
growth               How much did you learn or grow today? (1-10)
sleep_hours          How much did you sleep? (hours, the night before this date)
dream_vibe           How was the vibe of your dream(s)? (1-10, the night before this date)
rested               How rested did you feel when you woke up? (1-10)
day_memos            Number of day voice memos
dream_memos          Number of dream voice memos
day_memo_seconds     Total length of day memos
dream_memo_seconds   Total length of dream memos
complete             1 = day memo + all day questions answered

In R:  d <- read.csv("survey.csv"); d$date <- as.Date(d$date)
`;

function csvCell(v: string | number | null | undefined): string {
  if (v == null || v === '') return 'NA';
  if (typeof v === 'number') return String(v);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildCsv(entries: Entry[], memos: Memo[]): string {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const memoStats = new Map<string, { day: number; dream: number; dayS: number; dreamS: number }>();
  for (const m of memos) {
    const s = memoStats.get(m.date) ?? { day: 0, dream: 0, dayS: 0, dreamS: 0 };
    if (m.kind === 'dream') {
      s.dream++;
      s.dreamS += m.duration_ms / 1000;
    } else {
      s.day++;
      s.dayS += m.duration_ms / 1000;
    }
    memoStats.set(m.date, s);
  }
  const dates = [...new Set([...byDate.keys(), ...memoStats.keys()])].sort();
  const header = [
    'date', 'weekday', 'day_rating', 'social', 'social_with', 'social_note', 'growth',
    'sleep_hours', 'dream_vibe', 'rested', 'day_memos', 'dream_memos', 'day_memo_seconds',
    'dream_memo_seconds', 'complete',
  ];
  const lines = dates.map((d) => {
    const e = byDate.get(d);
    const s = memoStats.get(d) ?? { day: 0, dream: 0, dayS: 0, dreamS: 0 };
    const complete = e && s.day > 0 && e.rating != null && e.growth != null && e.social != null ? 1 : 0;
    return [
      d,
      WEEKDAYS[new Date(`${d}T12:00:00`).getDay()],
      e?.rating,
      e?.social,
      e?.social_with ? e.social_with.split(',').join(';') : null,
      e?.social_note,
      e?.growth,
      e?.sleep_hours,
      e?.dream_vibe,
      e?.rested,
      s.day,
      s.dream,
      Math.round(s.dayS),
      Math.round(s.dreamS),
      complete,
    ]
      .map(csvCell)
      .join(',');
  });
  return [header.join(','), ...lines].join('\n') + '\n';
}

export interface ImportResult {
  entries: number;
  memosAdded: number;
  memosSkipped: number;
}

/** Let the user pick a backup .zip and merge it into the journal. Returns null if cancelled. */
export async function pickAndImportBackup(db: SQLiteDatabase): Promise<ImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets.length) return null;
  const bytes = new File(res.assets[0].uri).bytesSync();

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes);
  } catch {
    throw new Error('This file is not a journal backup (.zip).');
  }
  if (!unzipped['journal.json']) throw new Error('This zip does not contain a journal backup.');
  const json = JSON.parse(strFromU8(unzipped['journal.json'])) as BackupJson;
  if (json.app !== APP_ID || !Array.isArray(json.entries) || !Array.isArray(json.memos)) {
    throw new Error('This zip does not contain a journal backup.');
  }

  let memosAdded = 0;
  let memosSkipped = 0;
  await db.withTransactionAsync(async () => {
    for (const e of json.entries) {
      if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
      const clean = { date: e.date } as Entry;
      for (const f of ENTRY_FIELDS) (clean as unknown as Record<string, unknown>)[f] = e[f] ?? null;
      await upsertEntry(db, clean);
    }
    for (const m of json.memos) {
      const data = unzipped[`memos/${m.file}`];
      // File names are generated by the app; reject anything that looks like a path.
      if (!data || !m.file || /[\\/]|\.\./.test(m.file) || (await memoFileExists(db, m.file))) {
        memosSkipped++;
        continue;
      }
      const f = memoFile(m.file);
      if (!f.exists) f.create();
      f.write(data);
      await addMemo(db, m.date, m.kind === 'dream' ? 'dream' : 'day', m.file, m.duration_ms ?? 0, m.created_at);
      memosAdded++;
    }
  });
  return { entries: json.entries.length, memosAdded, memosSkipped };
}

// ---------------------------------------------------------------- PDF report

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function exportPdf(db: SQLiteDatabase): Promise<void> {
  const [entries, memos] = await Promise.all([allAnswers(db), allMemos(db)]);
  const memosByDate = new Map<string, Memo[]>();
  memos.forEach((m) => {
    if (!memosByDate.has(m.date)) memosByDate.set(m.date, []);
    memosByDate.get(m.date)!.push(m);
  });
  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  const dates = [...new Set([...entryByDate.keys(), ...memosByDate.keys()])].sort().reverse();

  const val = (v: number | null) => (v == null ? '–' : String(v));
  const rows = dates
    .map((d) => {
      const e = entryByDate.get(d);
      const ms = memosByDate.get(d) ?? [];
      const dayMs = ms.filter((m) => m.kind === 'day');
      const dreamMs = ms.filter((m) => m.kind === 'dream');
      const memoText = (list: Memo[]) =>
        list.length ? `${list.length} (${list.map((m) => formatDuration(m.duration_ms)).join(', ')})` : '–';
      const social =
        e?.social == null
          ? '–'
          : e.social === 1
            ? `Yes${e.social_with ? ` · ${esc(e.social_with.split(',').join(', '))}` : ''}${
                e.social_note ? `<div class="note">${esc(e.social_note)}</div>` : ''
              }`
            : 'No';
      return `
      <div class="entry">
        <h3>${esc(formatLong(d))}</h3>
        <table>
          <tr><td>${DAY_SCALES.rating.label}</td><td>${val(e?.rating ?? null)}</td></tr>
          <tr><td>Social</td><td>${social}</td></tr>
          <tr><td>${DAY_SCALES.growth.label}</td><td>${val(e?.growth ?? null)}</td></tr>
          <tr><td>Hours slept</td><td>${e?.sleep_hours != null ? `${formatHours(e.sleep_hours)} h` : '–'}</td></tr>
          <tr><td>${SLEEP_SCALES.dream_vibe.label}</td><td>${val(e?.dream_vibe ?? null)}</td></tr>
          <tr><td>${SLEEP_SCALES.rested.label}</td><td>${val(e?.rested ?? null)}</td></tr>
          <tr><td>Day memos</td><td>${memoText(dayMs)}</td></tr>
          <tr><td>Dream memos</td><td>${memoText(dreamMs)}</td></tr>
        </table>
      </div>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1F2333; margin: 24px; }
    h1 { margin: 0 0 4px; } .sub { color: #6B7280; margin-bottom: 24px; }
    .entry { page-break-inside: avoid; border-top: 1px solid #E5E7EB; padding: 8px 0 12px; }
    h3 { margin: 6px 0; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    td { padding: 3px 6px; vertical-align: top; } td:first-child { color: #6B7280; width: 55%; }
    .note { color: #1F2333; font-style: italic; margin-top: 2px; }
  </style></head><body>
  <h1>My Journal</h1>
  <div class="sub">${dates.length} entries · exported ${esc(formatLong(todayKey()))}<br/>
  Voice memos are not part of this PDF. They are included in the backup (.zip).</div>
  ${rows || '<p>No entries yet.</p>'}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  // Give the PDF a readable name before sharing.
  const named = new File(Paths.cache, `journal-${todayKey()}.pdf`);
  if (named.exists) named.delete();
  new File(uri).moveSync(named);
  await share(named.uri, 'application/pdf', 'Save journal PDF');
}
