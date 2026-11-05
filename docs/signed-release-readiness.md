# Android signed release readiness

## pnpm integration candidate

PR #15 reconciles the pnpm migration with main `261c16457653943ed0014de113a3b7a54350f68d`.
Use pinned pnpm 10.29.3 and `pnpm-lock.yaml` for current setup; npm commands and
the separate-migration status below are historical observations, not current
instructions for this candidate. The glob/minimatch security overrides now live
under `pnpm.overrides`. All four workflows use frozen pnpm installs; the permanent
unsigned/release build jobs retain disabled lifecycle scripts, SHA-pinned actions,
and their audit/security checks. The separate protected signing job still runs no
package manager, Expo or Gradle and has no dependency cache.

The candidate aligns Expo to `~58.0.23`, Metro runtime to `~58.0.17` and safe-area
context to `~5.11.1`. Local compatibility, type/unit/contract/security, web/browser
and Android/iOS Hermes-export checks do not establish a native build or device
acceptance. Exact-head hosted native checks and independent review remain merge
gates; signed builds, Play uploads and release approval remain separate actions.

### Credential-free native verification before any signing approval

`android-store-candidate.yml` runs on PRs/manual dispatch and builds the permanent
Android package as unsigned APK/AAB. It uses **test-only code 1**, never selects a
Play versionCode, never accesses signing environments/secrets and never uploads to
Play. Its retained native artifacts include independent actual-AAB manifest/API,
permission inventory, unsigned-input, native-16-KB and bundle-configuration reports.
Inspect that exact-head hosted run before approving any later signed build. A green
preview build under a prototype ID is not equivalent evidence.

Both unsigned build paths explicitly provision build-tools 36 and require the real
apksigner password regression after provisioning; missing SDK fails rather than
silently skipping this gate. The regression demonstrates reused one-line password
file failure, same-password PKCS12 fallback success, and distinct environment-source
success even for equal password values. Leafellow uses the PKCS12 fallback; Wordmine
uses distinct password environment variables. A real retained preview APK was also
re-signed and verified with a disposable key to exercise the corrected command;
this is crypto integration evidence, not either app's store release or device QA.


## 2026-11-03 continuation — internal testing first

The extra native iOS acceptance run exposed a real Expo Modules JSI Swift compile
failure under Xcode 26.2 (`sending 'slot' risks causing data races`). The manual iOS
job now matches Leafellow's verified macos-26 / Xcode 26.6 toolchain rather than
patching third-party sources or suppressing concurrency diagnostics. The existing
iPhone17/iOS26.2 simulator pin is preserved: that runtime was read back on the
passing sibling runner. A config regression test protects the toolchain selection;
only a successful hosted compile/runtime run establishes actual compatibility.

Joey explicitly chose **internal testing first**. Public distribution remains
blocked on useful rights-cleared native content and policy readiness. The native
three-word synthetic sample is not a finished public product. Configuration green,
PWA tests, signing, and internal upload do not authorize public launch.

The earlier local signing/dependency work is preserved in a fresh current-main
branch. Permanent package: `com.reallyenglish.wordmine`; prototype builds remain
explicitly isolated. App version remains 0.1.0. The owner must choose an unused
positive versionCode after checking all Play uploads. The signing environment
still allows main only; ListenUp's production branch and 2026.1 version are not
copied blindly to this separate app.

The isolated signing runner now checks **actual AAB bytes**, not build-supplied
manifest XML, with SHA256-pinned bundletool 1.18.3 before secrets enter scope and
again after signing. Checks: exact package and both version fields, target API
>=36, non-debug/test-only flags, permission inventory, arm64 presence, 64-bit ELF
16-KB alignment and 16-KB bundle ZIP configuration. The independently dumped APK
manifest, ZIP alignment and exact upload signer are also checked. Reports,
checksums, source/version/certificate provenance and signed APK/AAB are retained
for 14 days. These checks do not replace Play processing or release-device QA.

Normal CI now includes release negative controls, real-JDK signature controls and
`npm audit --audit-level=low`. This branch retains main's npm lock; pnpm migration
PR #15 needs separate reconciliation before integration. Dependency/schema changes
carried from the prior local branch require complete exact-head contract and native
CI; audit zero alone is not compatibility evidence.

Live 2026-11-03 readback confirmed main-only `android-signing`, reviewer joeywang,
admin bypass disabled and five expected secret names. Self-review prevention is
false for owner initiation/review; an agent must never approve the protected job.
Secret presence does not prove successful decryption/signing.

After a separately approved merge and signed-build authorization, use:

```sh
gh workflow run android-signed-release.yml --repo reallyenglish-global/wordmine \
  --ref main -f version_code=UNUSED_POSITIVE_INTEGER
```

Replace the placeholder only with an owner-checked unused code. This is build-only:
no Publisher credentials, upload or rollout. Approve the exact-source protected job
as a human, archive its verified artifacts, install the signed APK and exercise
study/restart/offline behavior. First Console internal-track draft upload requires
separate approval. The Play entry exists, but Console package registration,
app-signing/upload fingerprints, policy forms and processing are not verified here.
Independent/off-host key recovery remains an owner gate. Earlier local signer
checks are not evidence that a native release bundle has been signed successfully.


## Owner-approved setup — supersedes the historical audit below

The owner confirmed this is a new standalone Android app and approved `com.reallyenglish.wordmine`, new upload-key preparation, secure Google/GitHub storage, and dependency remediation. This does not authorize Play upload/rollout, merge, or code push.

### Implemented locally

- Permanent Android ID in `app.json`. iOS identity unchanged; no iOS signing/listing decision was requested.
- Existing prototype CI/unsigned-candidate workflows opt into `WORDMINE_ANDROID_PROTOTYPE=1`, preserving their existing Maestro identity. Normal config uses the permanent Android identity. Release config rejects simultaneous prototype mode and invalid/out-of-range version codes.
- New manual `android-signed-release.yml`: main-only, explicit owner-selected unused versionCode; a secret-free build job compiles release APK/AAB without Expo debug signing, and a separate fresh signing VM uses the protected `android-signing` environment. The signing job never installs npm dependencies, runs Expo/Gradle or restores their caches. All actions are pinned to verified commit SHAs, checkout credential persistence is disabled, and dependency lifecycle scripts are disabled in the build job. Signer identity is checked for both APK and AAB, manifests are checked, checksums/provenance are recorded, and signed artifacts are retained for 14 days. No Play API or upload step.
- APK verification includes apksigner, certificate comparison, package/version/target API/non-debuggable checks, and zipalign 16 KB page alignment. This does **not** prove every native ELF library is 16 KB compatible; final library/device checks remain required.
- Archive verification requires both a strict successful jarsigner result **and** its affirmative verification message. A wholly unsigned archive can return exit zero even with `-strict`. Real regression tests accept the trusted signature and reject unsigned, injected unsigned-entry, and other-signer archives.

### Signing custody — actual external state

- New RSA-3072 PKCS12 upload key, password-protected, 10,000-day validity. Local custody is outside the repository with directory mode 0700 and private files 0600. Keep the existing key on retries; never regenerate it silently.
- Public upload-certificate SHA-256: `00:73:42:BA:43:2E:FA:23:3C:D8:9A:DC:84:A8:12:17:0F:79:2E:F8:B4:7F:94:45:6C:73:2F:08:DA:46:AD:2F`.
- GitHub environment created and read back: `android-signing`; required reviewer `joeywang`; admin bypass disabled; exact `main` branch only (no tag rule). Self-review prevention is disabled so the owner can initiate and personally approve a run using the same account. The agent must never approve on the owner's behalf.
- Five environment secret names installed and read back: `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_CERTIFICATE_PEM`. Secret-name presence does not prove a hosted job can decrypt/use them.
- **Google Secret Manager backup remains blocked.** The Google user credential requires reauthentication; the available service account cannot list secrets in the configured project. No IAM changes, alternate project selection, Google key enrollment, or secret creation were attempted to bypass this. Restore the authorized Google login and confirm the target secret project before completing independent backup.
- This is the **upload** key, not Google's app-signing key. Play App Signing enrollment/certificate registration is not verified. Direct APK tests use the upload signer; Play-delivered APKs may have Google's distinct app-signing certificate.

### Dependency assessment and remediation

The original audit reported 3 high, 10 moderate, 2 low affected package nodes; parent-node counts are not a count of distinct vulnerabilities. High findings included node-forge parsing/memory-exhaustion and Zod recursive-schema exhaustion. Other findings affected glob/minimatch resource bounds, fast-uri normalization and deepmerge. Build-tool reachability is different from learner-runtime reachability, but no advisory was simply waived.

- Upgrade Expo 57 to 58 and align its supported React 19.3 / React Native 0.88.1 / Expo module versions. This removes the vulnerable deepmerge dependency and obsolete Expo dependency paths rather than forcing an incompatible replacement config package into SDK 57.
- Upgrade direct Zod to 4.6.7 (application already imported `zod/v4`), resolving recursive-schema exhaustion. Regenerate the schema with the upgraded generator; the single-member discriminated union changes `anyOf` to `oneOf`, which is equivalent for its current single variant. Fixture behavior remains verified.
- Resolve node-forge and fast-uri to patched releases in the lockfile.
- Override transitive glob to `^14.0.3` and minimatch to `^11.0.1` because Expo's declared glob 13/minimatch 10 ranges exclude their advisory fixes. These are deliberate major build-tool overrides, requiring prebuild/bundle/native CI verification, not an unreviewed `npm audit fix --force` downgrade.
- Declare test dependency `yaml` explicitly; SDK 58 no longer happens to provide it transitively.
- Fresh `npm ci --ignore-scripts` and `npm audit --audit-level=low`: **0 vulnerabilities**. The scanner result is a snapshot, not proof of absence of undisclosed issues.

### Observed verification

- TypeScript check: passed.
- Node test suite: **130 passed, 0 failed** (including the real composed Expo entrypoint and structural YAML job-separation/pinning assertions).
- Contract check: **3 valid / 12 invalid fixtures**, schema synchronized.
- Real JDK signature regression test: passed (trusted, unsigned, injected, other signer cases).
- Expo compatibility check: dependencies up to date.
- Web production build: passed; browser suite **70 passed** across desktop and Android-mobile-web projects (browser emulation is not native acceptance).
- Android SDK 58 prebuild with permanent package/versionCode: passed; removing template debug release signing: passed.
- Android JavaScript export with `--no-bytecode`: passed, 758 modules. Normal Hermes bytecode compilation could not run because the shipped Linux compiler is x86_64 and this host is ARM64. Do not report this JS-only check as Hermes/native compilation success.
- Release workflow YAML and every shell step passed parsing/`bash -n`; `git diff --check` passed.

### Remaining gates / next owner actions

1. Restore Google authentication and confirm Google Secret Manager backup project; complete and read back the backup before relying on this custody setup.
2. Review and authorize code push/PR (these implementation changes remain local), then review native hosted CI for the Expo/RN upgrade and merge only with separate approval. Coordinate with open pnpm migration PR #15; do not overwrite its lockfile/workflow changes blindly.
3. After reviewed integration to `main`, authorize/dispatch the build-only signed workflow with a versionCode checked against Play history, and personally approve its environment gate. This preparation has produced **no signed APK or AAB**.
4. Verify actual signed artifacts, ELF 16 KB compatibility, final permissions and target API, release-device cold start/offline/resume/upgrade, secure off-host key recovery, Play App Signing enrollment and required Console declarations. Upload/track rollout remains separately authorized.

## Historical audit (before owner decisions and implementation)

## Verdict

**Blocked before signed release build; not ready for Google Play upload.** This is an evidence record, not a release authorization or substitute for artifact verification.

## Source and observed checks

- Repository: reallyenglish-global/wordmine.
- Reviewed current fetched main: `1b17b5705054b3b13c5e30585d4e71870847e9d2`.
- Existing PR #15 proposes pnpm migration and was open at inspection. Do not conflict with its package-manager changes; refresh main before implementing release configuration.
- Isolated preparation branch: `chore/signed-release-readiness`.
- Fresh `npm ci`: successful; reports 15 affected dependency nodes (3 high, 10 moderate, 2 low). No forced dependency updates performed.
- `npm run typecheck`: passed.
- `npm test`: 126 passed, 0 failed.
- `npm run contract:check`: passed; 3 valid and 12 invalid fixtures behaved as declared.
- `npx expo install --check`: dependencies up to date.
- Main CI run 41352307964 succeeded: contracts, production native JS/Hermes bundling, prototype APK compilation, and web/PWA tests. Native Android runtime acceptance was skipped. None of this verifies a signed release.
- Manual android-aab-candidate workflow run query returned no runs.
- GitHub environment inventory returned zero environments; repository secret-name inventory was empty. This does not prove that no signing credentials exist elsewhere.
- Host has Java 17; ANDROID_HOME/ANDROID_SDK_ROOT are unset. No local Android release compilation was attempted. Prefer hosted x86_64 native build/acceptance rather than introducing host tooling without need.

## Blocking decisions and evidence

1. **Permanent application identity.** app.json still uses `com.reallyenglish.wordmine.prototype` and display name `WordMine Next`. Existing candidate scripts deliberately reject non-prototype identities. Confirm the permanent package and whether this is a new listing or an update. Never infer the package from a Play Console numeric app ID. An update must preserve package/signing lineage and use a fresh versionCode.
2. **Signing custody.** Confirm existing upload-key custody and Play App Signing status before generating anything. Establish protected human-reviewed signing storage, secure backup and expected public certificate fingerprint. Do not place private keys/passwords in source or chat.
3. **Release build path.** Existing manual AAB workflow builds an unsigned prototype, strips Expo debug release signing, and does not retain an AAB artifact. Add a separate approved permanent-config path; produce checksummed signed release APK (device testing) and signed AAB (Play upload). Fail closed on missing credentials and verify the actual signer against the expected upload certificate, not simply any valid signature. Keep build-only distinct from upload.
4. **Artifact acceptance.** Verify bundletool validation, actual package/version/code, non-debuggable manifest, target API, final permissions, shipped native libraries/16 KB compatibility, and physical-device release cold launch/offline/resume/upgrade. No signed APK/AAB or release-device evidence was produced by this audit.
5. **Dependency findings.** Assess reachability and compatible fixes for reported advisories; successful Expo compatibility and tests are not a security waiver.
6. **Play Console.** The user-provided listing reference is known, but authenticated Console contents, upload-certificate enrollment, package/version history, privacy URL, Data safety, audience/content rating, listing assets, account-specific testing and track readiness were not verified. Console access or an owner-provided readout is required; an app dashboard URL is not proof of completion.

## Approval boundaries

No code was pushed or merged, no secrets were installed, no key was created, no signed build was dispatched and nothing was uploaded/published. This local evidence note is the only preparation change. Owner package/signing decisions are required before implementing permanent release configuration. Play upload and production rollout must remain distinct actions with an explicit target track.

## References

- Google Play target API policy: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en — retrieved during this audit; new phone/tablet apps and updates require API 36 from August 31, 2026.
- App Bundle format: https://developer.android.com/guide/app-bundle — Play generates device APKs from the uploaded AAB.
- Existing repository assessment: docs/vocabulary-engine-and-play-readiness.md.

## Reproducible read-only commands

```sh
gh repo view reallyenglish-global/wordmine --json defaultBranchRef,url
gh pr list -R reallyenglish-global/wordmine --state open
gh run view 41352307964 -R reallyenglish-global/wordmine --json headSha,jobs
gh run list -R reallyenglish-global/wordmine --workflow android-aab-candidate.yml
gh api repos/reallyenglish-global/wordmine/environments
gh secret list -R reallyenglish-global/wordmine
npm ci
npm run typecheck
npm test
npm run contract:check
npx expo install --check
git diff --check
```

Refresh live source/workflow status before release work; these commands document an observed snapshot, not future guarantees.
