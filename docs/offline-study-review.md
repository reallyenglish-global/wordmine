# Offline study regression review

## Scope

Based on `origin/main` at `e486411`. Changes are limited to restoring the submitted spelling in the two locked recall inputs and additional browser E2E coverage. No storage format, grading, service worker, dependency, workflow, account, reporting or production configuration changes.

Both local study and bundled package practice previously restored grading and progress but displayed an empty locked spelling field after reopening. The input now reads the persisted answer whenever a graded result exists; unanswered cards still use the editable draft.

## Regression evidence

Before the fix, both new incorrect-answer fresh-page tests failed: expected input value `my-wrong-answer`, received an empty string. Both failures occurred after the offline page had loaded through the real service worker and restored the expected card and incorrect-answer feedback.

The final suite adds 10 scenarios, each executed in desktop Chromium and Pixel 7 browser emulation (20 additional executions, 58 total):

- Local and package correct/incorrect spelling restored in a **fresh offline page**, retaining the answer and input lock; continue to completion, verify 6/6 or 5/6, then reload offline and verify the same score (four scenarios).
- Local and package unanswered recall preserved across fresh-page offline resume, reconnect, submission and subsequent offline reload (two scenarios).
- Local and package transient quota/write failure reported honestly, then recovery on the next offline save; reload verifies the previously answered card was persisted (two scenarios).
- Package completion/restart leaves regular study progress unchanged offline (one scenario).
- Manifest and both icons remain available offline, shell navigation is served by the service worker, and arbitrary uncached requests fail instead of receiving cached application HTML (one scenario).

The storage-failure tests inject only a `Storage.setItem` exception; app-shell loading, persistence, grading and navigation use the real built application. Fresh-page spelling tests poll the persisted answer rather than treating a visible saved-status footer as proof of a completed write. Screenshots are saved under Playwright's `test-results/` and were visually reviewed in mobile emulation.

An independent packet-only Claude Sonnet review found no blocking issue. Its suggestions to cover correct as well as incorrect fresh-page answers, wait on actual persistence, and continue through final scoring were incorporated. The reviewer did not execute tests.

## Reproduction and observed final results

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run contract:check
npm run build:web
npm run test:browser -- --reporter=json
npx expo export --platform android --platform ios --no-bytecode --output-dir dist-native-js
git diff --check
```

- TypeScript: passed.
- Unit/static tests: 113 passed, zero failures/skips.
- Contract: generated schema in sync; 3 valid and 12 invalid fixtures behave as declared.
- Production web export and PWA generation: passed.
- Final full browser suite: 58 passed, zero skipped, unexpected failures or flaky cases; retries were not added.
- Android and iOS JavaScript-only export: passed.
- Diff whitespace check: passed.

## Limits and merge gate

These are browser/PWA acceptance results, not evidence of a fresh offline installation or an installed Android/iOS runtime test. Initial online shell installation is required; browser storage eviction/private-mode restrictions remain platform limitations.

The default native export with Hermes bytecode failed locally because the SDK's bundled `hermesc/linux64-bin/hermesc` cannot execute on this ARM host. The subsequent `--no-bytecode` export verifies JavaScript bundling only and does **not** replace the exact-head hosted `native-bundles` job or emulator/device tests. No CI requirement was weakened and no build configuration was changed to bypass this limitation.

Push/PR publication requires approval. Exact-head hosted checks and GitHub's conflict/mergeability readback must pass before calling the PR merge-ready. Existing CI-maintenance PR #11 is separate and must not be modified or merged as part of this work. No merge, deployment, signing, distribution or production change is authorized by this review.
