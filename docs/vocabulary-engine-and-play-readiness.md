# WM-NEXT vocabulary engine and Google Play readiness

Assessment: 2026-11-01. Inspected main `3996570980904f101e3e4415bd12d539bfe70733` and this PR. This is the WordMine app in `reallyenglish-global/wordmine`, not wm-lib, wm-api or a Google App Engine deployment.

## Verdict

**Working local-first prototype; not a store-ready vocabulary product.** The reusable engine is a credible foundation, but a working APK is not equivalent to useful learning content, a learning model, or permission to publish. No defensible completion percentage or launch date follows from the repository: the release owner, account type, content rights and product scope remain unconfirmed.

The narrowest recommended first release is a **standalone, offline vocabulary app with licensed/bundled content and local practice results**. This is a proposal, not an approved product decision. Login, cloud sync, institutional assignment/reporting, subscriptions, speech scoring and generated content should not be prerequisites unless explicitly required. They materially expand privacy, backend and correctness work.

## What is implemented and what this PR changes

Evidence in `App.tsx`, `src/package/{reader,evaluate,session}.ts`, `src/study/`, `contracts/pack-v0/`, and `.github/workflows/ci.yml`:

- Expo/React Native Android/iOS/web shell, offline web shell caching and device-local progress.
- Meaning recognition and typed recall; explicit submit, locked first answer, alternative spelling and normalized grading.
- Validated content manifest/schema, file hashes, cross-reference checks and ahead-of-time validators suitable for native runtimes without dynamic code generation.
- Progress pinned to package ID, manifest hash, content version and list ID; invalid or mismatched sessions cannot silently become another content version's progress.
- Browser regression coverage plus separate hosted native bundle, preview APK and manually dispatched native-runtime jobs. PR green alone does not mean manual native jobs ran.

This PR adds `src/engine/practice.ts`, used by the actual package-practice screen. `createPracticeEngine(validatedContent, listId)` exposes cards, storage key, fresh/restore/submit/advance operations and a word-level summary. It is independent of React, AsyncStorage, network and backend. Multiple list engines can share content without sharing progress. Existing session JSON, storage keys, package hashes and grading semantics stay unchanged. The original hard-coded study path stays separate.

The completion UI now separates recognition from recall and suggests more practice for words with an incorrect answer. This is **one-attempt feedback**, not a longitudinal mastery score, spaced-repetition scheduler or automatic weak-word review queue. Unanswered cards are not classified as incorrect. `complete` requires the final advance, not merely answering the last card.

Example adapter boundary:

```ts
import {readPackage} from '../src/package/reader';
import {createPracticeEngine} from '../src/engine/practice';

const content = readPackage(files); // validated bytes, not arbitrary objects
const engine = createPracticeEngine(content, selectedListId);
let state = engine.restore(await storage.getItem(engine.storageKey));
state = engine.submit(state, answer); // first accepted answer remains locked
await storage.setItem(engine.storageKey, JSON.stringify(state));
state = engine.advance(state); // unanswered cards cannot advance
await storage.setItem(engine.storageKey, JSON.stringify(state)); // persist every transition
const result = engine.summary(state);
```

Only pass states returned by this engine's create/restore/submit/advance methods. This is a trusted local API, not a hostile-input boundary or server assessment/reporting endpoint. Package hashes provide integrity, not publisher authenticity: a downloaded package would also need trusted provenance. Keep persistence and download lifecycle in adapters. Do not reuse client practice results as authoritative course reporting.

## Gaps for a useful WordMine-like solution

### P0 — content and learner journey (product/content owner)

Current app ships original synthetic harbor/lantern/meadow examples, with demo/contract/rejection controls. `PackagePractice` still selects the first list; the engine supports list IDs but this PR does not add a list-browser UI.

- Define initial learners, target/support languages, proficiency range and offline promise.
- Provide a rights-cleared, reviewed vocabulary pack of meaningful scope, with accurate definitions, distractors and accepted spelling variants. Do not copy legacy protected content without permission.
- Add list selection, a simple learn/practice/results journey and release-specific navigation instead of exposed engineering demos.
- Test actual launch-pack size, load latency, scrolling, accessibility, keyboard interaction, persistence and offline cold launch; the three-word fixture cannot establish scalability.
- Add pronunciation/example/media only if in the agreed launch scope; current assets are validated but not rendered.

Acceptance: a new learner can choose an intended list, practice its real content, understand mistakes, leave/reopen offline and resume correctly on a physical Android device.

### P1 — learning engine decisions (learning/product owner)

If the goal is lasting vocabulary retention rather than a simple practice app, agree these contracts before implementation:

- Word/sense identity; recognition versus recall; when/if a word is considered learned.
- Weak-word retry versus spaced review, due-date ordering, deterministic clock handling and repeat-answer semantics.
- Attempt history versus replaceable current progress; content changes and migration/reset policy. Today a new manifest pins a new session, not a migration of learned-word history.
- For accounts or school reporting: authenticated identities, tenant isolation, ordered/idempotent progress delivery and cross-device conflict behavior. No backend is required for a strictly standalone offline launch, but these capabilities are absent.

Acceptance: explicit deterministic tests for the approved learning rules and cross-version progress behavior. No mastery claims based only on one correct answer.

## Google Play gates

### P0 — permanent release identity and owner

`app.json` uses `com.reallyenglish.wordmine.prototype`. `scripts/release-readiness.mjs` validates caller-supplied `WORDMINE_RELEASE_CONFIG` JSON; there is no checked-in final store configuration. Its configuration gate checks permanent application ID, version/build numbers and rights/privacy approval, but never applies those values to a native build. Even with valid configuration it deliberately reports `store.ready:false` pending independent artifact/device/Console evidence. It does not validate privacy/support URLs, which remain a separate owner gate. `scripts/android-aab-candidate.mjs` restricts its build to the prototype identity and emits `signed:false, storeReady:false`.

Owner must decide **new standalone listing versus replacement/update of an existing WordMine listing**. An update must match that listing's application ID, signing lineage and version-code history; do not guess these from the display name. Then explicitly configure permanent identity, versions and a monotonic code allocation policy. A workflow's run number alone is not a durable cross-workflow release policy.

### P0 — reproducible signed candidate and native compatibility

- Establish Play App Signing/upload-key ownership and an approved, protected signing path. Do not commit keys or reuse preview keys.
- Execute an exact-head release AAB build and verify certificate, application ID, version/code, bundle validation, final manifest permissions and target SDK. No successful run of the manual `android-aab-candidate.yml` workflow was returned by the live run query during this assessment. Workflow source is not execution evidence.
- That manual candidate workflow currently validates a prototype unsigned bundle and does **not upload an AAB artifact**. Retaining a checksummed candidate is a follow-up, not proof that a downloadable release exists.
- Google currently requires Android 16 / API 36 for new phone/tablet apps and updates from August 31, 2026. Verify the generated candidate manifest rather than infer it from the installed build-tools version.
- Verify 16 KB page-size compatibility of every shipped native library and runtime on an appropriate emulator/device. A React Native/Expo version or successful build alone is not evidence.
- Repeat cold-launch, offline resume, interruption/kill/reopen, keyboard, long-list and upgrade tests on the final release build and representative physical devices; inspect Play pre-launch reports after an authorized test-track upload.

### P0 — listing, privacy, rights and declarations

Confirm publisher/account verification, app title/branding, icon, screenshots, feature graphic, support contact, public privacy URL, distribution countries, content rating, target audience, ads declaration, Data safety answers and content/media licences. Audit actual release permissions and SDK/network behavior before declaring no data collection. Offline/local-only still requires applicable privacy disclosures. Account deletion is relevant if account creation is introduced, not a reason to add accounts now. Children/families, ads, AI and billing obligations depend on the selected audience/features and cannot be completed from source alone.

### P0 — testing track and owner publication approval

The owner must confirm Play Console account type and existing app access. For personal accounts created after November 13, 2023, the published rule is at least **12 opted-in closed testers continuously for 14 days**, followed by an application for production access. Do not impose that minimum on every existing organization account. Review time and production approval are external dependencies, not CI tasks. Internal testing, production access and final publication are distinct approvals.

### P1 — dependency exposure/remediation

The historical `docs/release-dependency-review.md` records its earlier snapshot, not current security status. Fresh `npm audit --omit=dev --json` on this lockfile returns 15 affected package nodes: 3 high, 10 moderate, 2 low. Direct affected dependencies include Expo and zod; suggested fixes include major-version changes. These are package-node counts, not 15 distinct root vulnerabilities or established APK exploits. Perform dependency-path/reachability and compatible-upgrade review; do not use forced audit fixes or treat this PR as risk acceptance.

## Delivery sequence and exit criteria

1. **This PR — reusable local engine + truthful feedback + assessment.** Preserve existing progress and package contracts; test mixed outcomes, reload, cross-list isolation and rejection behavior.
2. **Product/content PR — useful standalone pilot.** Approved scope/content rights; selectable lists and release navigation; real content and device UX acceptance. Decide whether weak-word review or a scheduler is essential to this first release rather than silently adding learning semantics.
3. **Release-candidate PR — identity/configuration and candidate evidence.** Owner-approved listing/update decision, version policy, retained signed AAB, manifest/certificate/16 KB checks, compatible dependency remediation and exact-head native acceptance. Signing credential operations remain separately authorized.
4. **Owner-operated Play test/release gate.** Complete declarations/listing; upload to an authorized test track, resolve pre-launch findings and applicable tester requirements; publish only after explicit approval.

The engineering foundation is ahead of the product and store-operation readiness. These are separate deliverables, not a single packaging fix. No merge, signing, store upload or publication is authorized by this PR.

## Verification for this PR

- Test-first focused engine suite initially failed because the module did not exist; passed after implementation.
- `npm run typecheck`: exit 0.
- `npm test`: 117 passed, 0 failed.
- `npm run contract:check`: schema synchronized; 3 valid and 12 invalid fixtures behave as declared.
- `npm run build:web`: successful production web/PWA export.
- `npm run test:browser`: 40 passed; desktop Chromium and Pixel 7 **browser emulation**, not native Android. Includes mixed recognition/recall results, accepted alternative spelling, reload and clean restart.
- Fresh native bundle/CI outcomes are reported on the PR separately. No claim of final AAB, physical-device, 16 KB or Play Console verification.
- `npm audit --omit=dev --json`: nonzero with the findings above; not hidden by successful functional tests.

Rollback: revert this PR. The bundled content and persisted session format are unchanged; no data migration, network/API, signing or store mutation is introduced.

## Official policy references (retrieved 2026-11-01; recheck at submission)

- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [16 KB page-size support](https://developer.android.com/guide/practices/page-sizes)
- [Testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [User Data policy, including third-party SDK responsibility](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
