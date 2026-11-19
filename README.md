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

## Build an APK locally (Windows)

Needs Android Studio (SDK + bundled Java) and Windows long paths enabled
(`HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1`).
The project path contains `&` and is too long for the native build, so build from a short copy:

1. Copy the project (without `node_modules`, `.git`, `android`) to `C:\pj`, run `npm ci`.
2. `npx expo prebuild --platform android --no-install`
3. In `android/gradle.properties` set `reactNativeArchitectures=arm64-v8a`.
   In `android/app/build.gradle`, inside `android {`, add
   `externalNativeBuild { cmake { buildStagingDirectory "C:/c" } }`.
4. With `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`:
   `cd android; .\gradlew.bat assembleRelease`
5. APK: `android/app/build/outputs/apk/release/app-release.apk`

Alternative without local tools: `npx eas-cli build -p android --profile preview` (Expo cloud).

## Next steps

- Export / backup of entries and memos.
