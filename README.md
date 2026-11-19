# Phone Journal

A voice-first daily journal for Android (and iOS), built with Expo / React Native.

## Features

- **One entry per day**, browsable as a list or a colour-coded calendar with monthly stats and streak.
- **Voice memos** for your day and for dreams: record as many as you like, play back, delete.
- **Daily Survey** (your day): day rating 1–10, social yes/no (with whom + note), learning & growth 1–10.
- **Sleep & Dreams** (last night, stored on the day you woke up): hours slept, dream vibe 1–10, how rested 1–10, dream memos.
- A day is **done** (green) once it has a day memo and the Daily Survey is answered.
- **Statistics** across years: daily values with moving average, monthly averages (± SE), month-vs-month comparison
  (Welch's t-test, also across years), and Pearson correlation between any two questions (e.g. dream vibe vs day).
- **Backup tab**: restorable `.zip` (entries + audio, readable `journal.json` inside), PDF report, import.
- Everything is stored **locally on the phone** (SQLite + audio files).

Questions are defined in `src/questions.ts`; new answer columns need a migration in `src/db.ts`.

## Run it on your phone (development)

1. Install **Expo Go** on your phone (Play Store / App Store).
2. On the PC, in this folder: `npm install`, then `npm start`.
3. Phone and PC on the same Wi-Fi, scan the QR code. If it can't connect: `npm start -- --tunnel`.

> The folder path contains `&`, which breaks `npx expo ...` on Windows. Use the `npm` scripts.

## Build an APK locally (Windows)

Needs Android Studio (SDK + bundled Java) and Windows long paths enabled
(`HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1`). Then:

```
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```

It builds in a short copy at `C:\pj` (the real path is too long for the native build) and puts
`Journal-<version>.apk` into this folder. Bump `version` and `android.versionCode` in `app.json` for each release.

## Project layout

```
App.tsx                 tabs + navigation
src/db.ts               SQLite schema, migrations, queries
src/backup.ts           zip backup / import, PDF export
src/memoFiles.ts        where recordings are stored
src/questions.ts        survey questions and stats metrics
src/stats.ts            mean / variance / Welch's t-test / Pearson
src/screens/            Journal, Calendar, Stats, Backup, Entry
src/components/         memo player, scale, social input, hours stepper
```
