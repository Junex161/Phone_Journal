# Phone Journal

A voice-first daily journal for Android (and iOS), built with Expo / React Native.

## Features

- **One entry per day**, browsable as a list or a colour-coded calendar.
- **Voice memos**: record as many as you like per day, play them back, delete them.
- **Quick check-in**: three 1–10 questions (day rating, energy, sleep). Edit them in `src/questions.ts`.
- **Dream journal**: optional section with its own voice memos.
- **Statistics**: daily values over the year with a moving average, monthly averages (± standard error), and a month-vs-month comparison using Welch's t-test.
- Everything is stored **locally on the phone** (SQLite + audio files). Nothing leaves the device.

## Run it on your phone (development)

1. Install **Expo Go** on your phone (Play Store / App Store).
2. On the PC, in this folder:
   ```
   npm install
   npm start
   ```
3. Make sure phone and PC are on the same Wi-Fi, then scan the QR code shown in the terminal with Expo Go (Android) or the Camera app (iOS).
   If the phone can't connect, try `npm start -- --tunnel`.

> Note: the folder path contains `&`, which breaks `npx expo ...` on Windows. Always use the `npm` scripts.

## Project layout

```
App.tsx                 tabs + navigation
src/db.ts               SQLite schema and queries
src/memoFiles.ts        where recordings are stored
src/questions.ts        the check-in questions
src/stats.ts            mean / variance / Welch's t-test
src/screens/            Journal list, Calendar, Stats, Entry
src/components/         memo player, 1–10 scale, card
```

## Next steps

- Build an installable APK with EAS (`npx eas-cli build -p android --profile preview`), so the app runs without Expo Go.
- Export / backup of entries and memos.
