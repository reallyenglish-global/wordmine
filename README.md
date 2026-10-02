# WordMine React Native prototype

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

## Contract boundary

`contracts/experimental-v0/meaning-definition.example.json` defines a **local-only example** for meaning-from-definition. `src/contract.ts` validates structural shape, non-empty IDs/labels, unique choice IDs, a present answer, and rejects unknown choices. These checks do **not** prove WordMine exercise parity, scoring, scheduling, authenticated learner state, idempotent attempts, course reporting, Mandarin correctness, or an approved publication contract. Do not copy a production wordlist into this public repository without a separately reviewed release and rights decision.

Before connecting to private services, independently review the [WM-NEXT epic](https://github.com/joeywang/re-work) and the pending Lexicon content and wm-api learning-contract draft PRs. Define one approved vertical contract with legacy behavior and sanitized fixtures, an additive versioned API and fallback, then verify it in wm-api, wm-lib and the mobile client. No client-side answer check here should be mistaken for authoritative course progress.

## Publication and licensing

This repository is publicly visible under the ReallyEnglish GitHub organization. The Expo template's MIT notice is retained as `EXPO_TEMPLATE_LICENSE.txt` for template attribution; **it is not a project-wide WordMine license**. No license for original WordMine source or content has been selected. Avoid importing private sources or unpublished/licensed vocabulary until that decision is made.
