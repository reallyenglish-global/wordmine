# WordMine Next — local-first React Native preview

Public **experimental** Expo/React Native shell for a WordMine Next activity-contract exploration. The repository uses original **synthetic** content and practice answer keys only; it contains no ReallyEnglish wordlist, private wm-api/wm-lib implementation, production answer keys, course data, tokens, or learner data. It is not a deployed product.

## Run and verify

Use Node 22 or newer (see `.nvmrc` and `engines`) and npm:

```sh
npm ci
npm run typecheck
npm test
npm run contract:check
npm run contract:schema   # regenerate the JSON Schema after editing src/contract/schema.ts
npm start
```

GitHub Actions performs contract, browser/PWA and native-bundle checks on PRs and main. On pushes to main only, a separate job runs Expo Android prebuild and Gradle `assembleDebug` on an x86_64 Linux runner, then uploads a short-lived prototype APK and SHA-256 checksum. Manual dispatch retains the separate Android release runtime acceptance jobs. It is **not** a release-signed or QA/production build, has not had device testing, and should not be distributed as a product.

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

### Activity end-to-end tests

`npm run build:web && npm run test:browser` tests the exported app in desktop Chromium and Pixel 7 mobile-browser emulation (touch, Android user agent and mobile viewport). These are real browser UI tests, **not native Android emulator/device tests**. Each case uses isolated browser storage; no production content or private API is used.

`tests/browser/activities.spec.ts` covers both the local study pack and bundled package:

- No advancing unanswered cards; empty/whitespace spelling cannot be submitted.
- Incorrect meaning/spelling feedback, locked first answers, and persistence after reload.
- Navigation/resume and clean input when moving to a different recall card.
- All six meaning/spelling cards completed offline, case/whitespace normalization, exact score, persisted completion, and persisted fresh restart.
- Contract-demo choice changes before submit, incorrect feedback, locked choices and clean retry; checked state is asserted through accessible radio semantics.

Existing package rejection/isolation, storage failure, CSP and PWA tests run in both projects too. Failure screenshots and Playwright traces are retained under `test-results/`, which the existing CI artifact step uploads. Offline-completion screenshots use per-test/per-project output paths. For a quick focused run:

```sh
npm run build:web
npx playwright test tests/browser/activities.spec.ts --project=android-mobile-web
# Inspect a failure trace:
npx playwright show-trace <path-to-trace.zip>
```

### Platform evidence and remaining gates

- Web/PWA: exercised locally in Chromium, narrow and desktop layouts. Install UI,
  Safari/iOS home-screen behavior and cache-upgrade lifecycle still need testing.
- CI now builds a revision-labelled non-debug Android preview APK on PR and manual runs; it is a disposable preview build using generated prototype signing, not a store-signed artifact. The `android-preview` job publishes the APK, SHA-256, source SHA and build metadata for seven days; it does not publish to a release, store, public endpoint, or bucket. The existing main-branch debug-prototype APK behavior is unchanged.
- Manual workflow dispatch downloads and checksum-verifies that exact preview APK before Android emulator acceptance; the iOS simulator remains a separate build. Preview emulator acceptance does not imply physical-device, store-signing or publication readiness.
- Physical-device checks, signing and store distribution remain separate gates. `npm run release:readiness` validates supplied JSON, not the actual native artifact: exit 0 means only `configuration.ready`; exit 1 means configuration blockers; exit 2 means missing/malformed JSON. `store.ready` stays false because build identity/version, signed AAB/certificate, target API/16 KB library compatibility, release-candidate device testing and Play Console acceptance still require independent evidence. It never applies configuration to Expo or authorizes publication.

## Synthetic package reader (WM-PACK-01)

**Explore package demo** opens a second bundled synthetic pack through `wordmine.package.v0`, without replacing the original local pack or its saved session. See [package format and limits](contracts/pack-v0/README.md).

- Manifest + ordered lists + words/senses + question parameters + separate practice keys + assets are validated from exact local bytes before any content is returned.
- Two capabilities: definition-to-meaning choice and definition-to-spelling. Reusable sense references generate cards; the meaning adapter also emits the existing `wordmine.activity.v0` envelope.
- Full Unicode 16.0.0 NFC/trim/casefold spelling policy, with explicitly authored alternatives (e.g. `harbor` / `harbour`). This is not legacy accent folding or Mandarin grading. The pinned mapping and whitespace set are generated from Python's Unicode 16 tables; the Unicode notice is included at `src/package/UNICODE_LICENSE.txt`.
- First answers are locked; completion, reload and offline resume use a separate storage namespace pinned to package ID, content version, manifest SHA-256 and list ID. Denied storage remains visibly temporary. No migration or overwrite of `wm-next:study:*` occurs.
- **Check rejection example** corrupts a synthetic candidate and demonstrates failed validation without altering current practice. This is not a general import UI or installer.

```sh
npx tsx scripts/bundle-package.ts --check
# Check or regenerate static validators after intentionally changing the package schema:
npx tsx scripts/generate-package-validators.ts --check
npx tsx scripts/generate-package-validators.ts
# Regenerate the bundle after intentionally changing fixture bytes/checksums:
npx tsx scripts/bundle-package.ts
# Optional reproducibility check; requires Python with Unicode 16.0.0:
python3 scripts/generate-casefold.py --check
```

Unit tests guard exact fixture-to-bundle byte equality. Browser tests exercise package completion, alternate spelling, rejection, reload/offline resume, denied/corrupt storage and preservation of original practice. The preview shows the first list and validates—but does not render—assets. SHA-256 integrity is not authentication. Media decoding, ZIP extraction, downloads, untrusted packages, signatures and large-pack performance remain outside this slice.

WM-PACK-02 replaces import-time Ajv compilation with checked-in static validators. `npm test` guards deterministic regeneration (including a deliberately stale-file rejection) and reruns the full package corpus with Node's `--disallow-code-generation-from-strings`. A browser test exercises real practice under a CSP without `unsafe-eval`, including an external-script negative control proving string code generation is blocked. The test allows inline bootstrap/styles; it is **not** a fully hardened production CSP or a deployment header change. Ajv is still a runtime dependency for small static validation helpers, not its compiler.

The existing manual Android/iOS acceptance entrypoint now also runs `.maestro/package.yaml`: synthetic meaning/spelling, explicit alternate spelling, cold relaunch persistence, invalid-candidate rejection and preservation of original study progress. Local YAML/control-flow checks are not native runtime proof; require an exact-head hosted acceptance run before claiming emulator/device support. Native compilation uses the existing disposable, non-store Release artifacts; no signing/distribution or deployment is added.

## Contract boundary

`contracts/experimental-v0/` holds a **local-only experimental** activity contract, `wordmine.activity.v0`:

- `activity.schema.json` is a JSON Schema (draft 2020-12) generated from `src/contract/schema.ts` by `npm run contract:schema`. It is the language-neutral artifact other repositories can validate against; `npm run contract:check` fails if it drifts from the TypeScript source. The schema covers structural validation, not cross-field rules such as unique choice IDs or an answer key matching its activity and choices. Consumers must enforce those rules separately; the TypeScript validator and fixture tests cover them here. Independent Ajv tests cross-check the schema, with TypeScript-only invalid fixtures explicitly marked `jsonSchemaDetects: false`.
- `fixtures/valid/` and `fixtures/invalid/` form the fixture corpus. Each invalid fixture names the field path it expects to fail on. Every fixture is checked by the tests and by `contract:check`; add fixtures rather than editing the scripts.
- One versioned envelope carries `contentVersion`, separate `languages.ui`, `languages.target` and `languages.explanation` tags, an `activity` discriminated on `kind`, and an optional `answerKey`. Every learner-visible string is `{ lang, text }` with a BCP 47 tag.
- The answer key is separate from the activity definition so a prompt-only document can be shipped. Grading goes through the `Grader` interface in `src/contract/grader.ts`; the bundled `LocalAnswerKeyGrader` returns an `ActivityOutcome` object, not a boolean.
- Unknown fields are tolerated and stripped, so later versions can add fields without breaking v0 readers. Validation failures list every field-level issue.

The home screen's **Explore contract demo** opens the separate schema-backed fixture preview without replacing the local study flow. The preview loads the fixture through a `ContentSource` seam (`src/content/`) and shows a readable error state if a document fails validation, instead of crashing at import. Selecting a choice does not grade it until **Check answer** is pressed; **Back to study** returns to the local pack.

These checks do **not** prove WordMine exercise parity, scoring, scheduling, authenticated learner state, idempotent attempts, course reporting, Mandarin correctness, or an approved publication contract. The `zh-Hans` fixture only exercises language tags; it is not vocabulary content. Do not copy a production wordlist into this public repository without a separately reviewed release and rights decision.

Before connecting to private services, independently review the [WM-NEXT epic](https://github.com/joeywang/re-work) and the pending Lexicon content and wm-api learning-contract draft PRs. Define one approved vertical contract with legacy behavior and sanitized fixtures, an additive versioned API and fallback, then verify it in wm-api, wm-lib and the mobile client. No client-side answer check here should be mistaken for authoritative course progress.

## Publication and licensing

This repository is publicly visible under the ReallyEnglish GitHub organization. The Expo template's MIT notice is retained as `EXPO_TEMPLATE_LICENSE.txt` for template attribution; **it is not a project-wide WordMine license**. No license for original WordMine source or content has been selected. Avoid importing private sources or unpublished/licensed vocabulary until that decision is made.
