# WordMine Next — local-first React Native preview

Public **experimental** Expo/React Native shell for a WordMine Next activity-contract exploration. The repository currently uses a **synthetic** word and definition; it contains no ReallyEnglish wordlist, private wm-api/wm-lib implementation, course data, answer keys, tokens, or learner data. It is not a deployed product.

## Run and verify

Use Node 22 and npm:

```sh
npm ci
npm run typecheck
npm test
npm run contract:check
npm start
```

GitHub Actions performs those contract checks on PRs and main. A separate job runs Expo Android prebuild and Gradle `assembleDebug` on an x86_64 Linux runner, then uploads a short-lived prototype APK and SHA-256 checksum. It is **not** a release-signed or QA/production build, has not had device testing, and should not be distributed as a product.

## Modern local study slice

One Expo/React Native + React Native Web application targets Android, iOS and web.
The first implemented slice is local-only: a versioned, original synthetic English
pack (3 words / 6 cards), deterministic meaning-choice and spelling recall,
first-answer feedback, on-device resume, completion and restart. Word/sense
parameters generate activities; this is not an opaque imported exercise deck.
AsyncStorage holds practice only. There is no authentication, sync, telemetry,
course completion, authoritative reporting, scheduling, or production content.
Corrupt/incompatible saved sessions reset safely; unavailable storage is surfaced
as temporary practice. Content version changes use a different storage key.

```sh
npm run build:web
npm run test:browser
# Local preview (loopback only):
python3 -m http.server 18741 --bind 127.0.0.1 --directory dist
# ARM-host JS-only smoke check, NOT a native build/device test:
CI=1 npx expo export --platform android --platform ios --no-bytecode --output-dir dist-native
```

Browser tests require Chromium; local default is `/snap/bin/chromium` and can be
overridden with `CHROMIUM_PATH`. CI installs Playwright Chromium. Acceptance tests
exercise choices, spelling, score, restart, reload resume, corrupt state, denied
storage and a real offline reload after the service worker installs.

The production web export adds a standalone manifest, original W icons and a
content-hashed shell cache. **Only the exported synthetic app shell is precached**;
there is no generic API/account caching. Use localhost or HTTPS for service
workers. First visit must be online; browser data eviction/clearing loses practice.
The service worker is not registered in Expo development mode. Do not deploy this
worker on a shared authenticated app origin without a new scope/cache review.

### Platform evidence and remaining gates

- Web/PWA: exercised locally in Chromium, narrow and desktop layouts. Install UI,
  Safari/iOS home-screen behavior and cache-upgrade lifecycle still need testing.
- Android/iOS: Metro production **JavaScript** export passes on the ARM dev host
  with `--no-bytecode`. The bundled Linux Hermes compiler is x86-64; normal bytecode
  export fails here. This flag is a debugging verification workaround, not a release
  configuration. Native compilation, emulator/device persistence and iOS signing
  remain unverified in this slice.
- CI changes add browser/PWA acceptance and full native bundle checks; the existing
  Android prototype APK job is retained. No claim of green remote CI is made until
  publication is authorized and those jobs actually run. iOS Xcode/device CI is a
  later separately reviewed slice.

## Contract boundary

`contracts/experimental-v0/meaning-definition.example.json` defines a **local-only example** for meaning-from-definition. `src/contract.ts` validates structural shape, non-empty IDs/labels, unique choice IDs, a present answer, and rejects unknown choices. These checks do **not** prove WordMine exercise parity, scoring, scheduling, authenticated learner state, idempotent attempts, course reporting, Mandarin correctness, or an approved publication contract. Do not copy a production wordlist into this public repository without a separately reviewed release and rights decision.

Before connecting to private services, independently review the [WM-NEXT epic](https://github.com/joeywang/re-work) and the pending Lexicon content and wm-api learning-contract draft PRs. Define one approved vertical contract with legacy behavior and sanitized fixtures, an additive versioned API and fallback, then verify it in wm-api, wm-lib and the mobile client. No client-side answer check here should be mistaken for authoritative course progress.

## Publication and licensing

This repository is publicly visible under the ReallyEnglish GitHub organization. The Expo template's MIT notice is retained as `EXPO_TEMPLATE_LICENSE.txt` for template attribution; **it is not a project-wide WordMine license**. No license for original WordMine source or content has been selected. Avoid importing private sources or unpublished/licensed vocabulary until that decision is made.
