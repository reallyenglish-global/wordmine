# WordMine React Native prototype

Public **experimental** Expo/React Native shell for a WordMine Next activity-contract exploration. The repository currently uses a **synthetic** word and definition; it contains no ReallyEnglish wordlist, private wm-api/wm-lib implementation, course data, answer keys, tokens, or learner data. It is not a deployed product.

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

GitHub Actions performs those contract checks on PRs and main. On pushes to main and manual dispatch only, a separate job runs Expo Android prebuild and Gradle `assembleDebug` on an x86_64 Linux runner, then uploads a short-lived prototype APK and SHA-256 checksum. It is **not** a release-signed or QA/production build, has not had device testing, and should not be distributed as a product.

## Contract boundary

`contracts/experimental-v0/` holds a **local-only experimental** activity contract, `wordmine.activity.v0`:

- `activity.schema.json` is a JSON Schema (draft 2020-12) generated from `src/contract/schema.ts` by `npm run contract:schema`. It is the language-neutral artifact other repositories can validate against; `npm run contract:check` fails if it drifts from the TypeScript source.
- `fixtures/valid/` and `fixtures/invalid/` form the fixture corpus. Each invalid fixture names the field path it expects to fail on. Every fixture is checked by the tests and by `contract:check`; add fixtures rather than editing the scripts.
- One versioned envelope carries `contentVersion`, separate `languages.ui`, `languages.target` and `languages.explanation` tags, an `activity` discriminated on `kind`, and an optional `answerKey`. Every learner-visible string is `{ lang, text }` with a BCP 47 tag.
- The answer key is separate from the activity definition so a prompt-only document can be shipped. Grading goes through the `Grader` interface in `src/contract/grader.ts`; the bundled `LocalAnswerKeyGrader` returns an `ActivityOutcome` object, not a boolean.
- Unknown fields are tolerated and stripped, so later versions can add fields without breaking v0 readers. Validation failures list every field-level issue.

The app loads the fixture through a `ContentSource` seam (`src/content/`) and shows a readable error state if a document fails validation, instead of crashing at import.

These checks do **not** prove WordMine exercise parity, scoring, scheduling, authenticated learner state, idempotent attempts, course reporting, Mandarin correctness, or an approved publication contract. The `zh-Hans` fixture only exercises language tags; it is not vocabulary content. Do not copy a production wordlist into this public repository without a separately reviewed release and rights decision.

Before connecting to private services, independently review the [WM-NEXT epic](https://github.com/joeywang/re-work) and the pending Lexicon content and wm-api learning-contract draft PRs. Define one approved vertical contract with legacy behavior and sanitized fixtures, an additive versioned API and fallback, then verify it in wm-api, wm-lib and the mobile client. No client-side answer check here should be mistaken for authoritative course progress.

## Publication and licensing

This repository is publicly visible under the ReallyEnglish GitHub organization. The Expo template's MIT notice is retained as `EXPO_TEMPLATE_LICENSE.txt` for template attribution; **it is not a project-wide WordMine license**. No license for original WordMine source or content has been selected. Avoid importing private sources or unpublished/licensed vocabulary until that decision is made.
