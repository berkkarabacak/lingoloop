# LingoLoop

A cross-platform English-learning MVP built from the supplied TikTok-style vocabulary specification. One swipe presents one word through a short contextual clip, highlighted subtitles, definitions, and examples.

## Implemented

- Shared Expo SDK 58 + React Native + Expo Router application for Web, iOS, and Android.
- Email registration/sign-in and Beginner, Intermediate, or Advanced level selection.
- Persistent backend accounts and bearer sessions with scrypt password hashing.
- Vertical native pager and web scroll-snap pager with keyboard controls.
- Active-only playback, preloading, posters, mute, replay, pause, loading, retry, and text fallback.
- Twenty-four seeded vocabulary lessons across three levels with locally generated placeholder clips.
- Saved vocabulary search, review player, and unsave.
- Quizzes unlocked after four completed words, four answer options, immediate feedback, scores, and XP.
- Persistent completion XP, daily streaks, quiz statistics, and seven-day progress chart.
- Web content studio with editing, JSON import/export, publishing checks, and MP4/poster uploads.
- Slow-loading and failed-video recovery paths.

## Run locally

Requires Node.js 24 and Python 3 with Pillow for regenerating placeholder posters. Node dependencies include a local ffmpeg binary.

From this directory:

```bash
npm install
npm run seed
npm run dev
```

Open `http://127.0.0.1:7100/`. The API listens on `127.0.0.1:4000`.

On Windows, `start-lingoloop.cmd` performs the same setup when needed and opens the browser.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Learner | `demo@lingoloop.local` | `learn123` |
| Administrator | `admin@lingoloop.local` | `admin123` |

The welcome screen also has a demo-account fill action. These are local development credentials only.

To promote another account:

```bash
npm -w @lingoloop/server run admin:promote -- --email you@example.com
```

Then open `http://127.0.0.1:7100/admin` as that administrator.

## Production web build

```bash
npm run build
npm start
```

The backend serves the exported web application and API on `http://127.0.0.1:4000/`.

## Native development

The same `mobile/src/app` routes and components target iOS and Android. Expo Video requires a compatible development or standalone build rather than assuming Expo Go includes it.

```bash
npm -w @lingoloop/mobile run start
```

For local native builds use `npx expo run:android` or `npx expo run:ios`; for cloud builds use `npx eas-cli@latest build --profile development`. Configure `EXPO_PUBLIC_API_URL` to a backend reachable from the device. Do not use `127.0.0.1` on a physical device.

Android uses native `AppState` handling to pause in the background and resume the same card. Completed lessons are queued in AsyncStorage after a network failure, deduplicated by video ID, and retried on foreground and every 15 seconds; the server awards completion XP idempotently.

### Local Android verification artifact

`artifacts/LingoLoop-local-release-x86_64.apk` is a self-contained local QA build for the Android 36.1 x86_64 emulator. It embeds the JavaScript bundle, uses `http://10.0.2.2:4000` for the backend, and was smoke-tested with Metro stopped. It is signed with the development debug key, has R8 shrinking disabled, and is not a production or phone/arm64 release.

The successful local build command from `mobile/android` was:

```bash
gradlew.bat assembleRelease --no-daemon -PreactNativeArchitectures=x86_64 -Pandroid.enableMinifyInReleaseBuilds=false
```

The build used CMake 3.31.6/Ninja 1.12.1 and a short-path checkout to avoid Windows native-build path limits. Local emulator HTTP cleartext support must not be carried into a production build.

## Verification

```bash
npm run typecheck
npm test
npm -w @lingoloop/mobile run lint
npm run build
CHROME_CHANNEL=chrome node tests/e2e.mjs
CHROME_CHANNEL=chrome node tests/resilience.mjs
```

On PowerShell, set the Chrome channel with `$env:CHROME_CHANNEL = "chrome"` before running the two browser commands. Omitting it uses Playwright's bundled Chromium instead.

The browser suites start isolated temporary servers on ports 4100 and 7101 and stop them afterward. They cover registration, level selection, playback, XP, paging, saved words, quiz completion, profile, admin publishing, slow loading, and video failure recovery.

The 2026-11-04 verification pass completed typecheck, lint, production Web build, and all 11 backend/shared tests. Android 36.1 emulator testing covered fresh registration, Intermediate selection, visible playback, one-card swipes, save/unsave, a five-question result, XP/streak persistence after restart, background pause/resume, Beginner feed reset, 1.3× system text, and offline completion followed by automatic XP synchronization. Evidence is under `artifacts/native-*.png`, `artifacts/native-*.xml`, and `artifacts/native-release-launch.json`.

On 2026-11-05, the full browser acceptance and resilience suites also passed in installed Google Chrome 156.0.8078.80 with zero console errors, zero failed requests, and zero mobile overflow. Screenshots are under `test-results/`.

## Content library

- `content/seed.json` contains the editable 24-item starter library.
- `npm run seed` regenerates placeholder media and imports content.
- Administrators can import/export the same JSON format through the web studio.
- Placeholder clips are explicitly labeled and are not presented as real-life footage.
- Replace placeholders with properly licensed clips and accurate attribution before a public release.

## Current release gaps

- Current target platforms are Android and Google Chrome Web. Firefox, Safari, and other browsers are outside the current verification scope.
- Google and Apple sign-in are not configured; email authentication is implemented.
- Android emulator build and runtime verification are complete for the flows above; physical Android hardware and arm64 packaging remain unverified.
- iOS is deferred by product decision. EAS was linked successfully, but Expo Simulators returned `available: false`; no remote-Mac purchase was made and no iOS build or runtime verification is claimed.
- The starter library contains 24 generated placeholders, not 100–200 curated real-life clips.
- Deferred AI tutoring, personalized AI quizzes, placement testing, spaced repetition, social features, subscriptions, and automated video generation/scraping are intentionally excluded.
- Moderate transitive development-chain advisories remain in Expo's glob/minimatch dependencies. npm's suggested remediation is a breaking Expo downgrade and was not applied.

See `CREDITS.md` for asset provenance.
