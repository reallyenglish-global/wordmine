# SDK 57 release dependency review

This is a bounded tooling/security patch, not a claim that the app is ready for Google Play.

## Supported patch path

The lockfile moves Expo 57.0.30 → 57.0.31 and its compatible tooling patches, including `@expo/config-plugins` 57.0.10 → 57.0.11. The upstream plugin patch declares `xcode: ^4.0.0`; xcode 4 uses Node's crypto UUID generation and removes the old `uuid` dependency. No override, forced security fix, React Native upgrade, SDK downgrade or application-identity change is used. The existing `~57.0.30` package range permits this Expo patch.

Locked changes: Expo, expo-modules-core, expo-modules-jsi, Expo CLI, router-server, config-plugins, xcode; uuid 7.0.3 removed. Other package versions stay unchanged.

Tests in `tests/xcode-prebuild.test.ts` guard the compatible upstream dependency path and absence of vulnerable uuid, and exercise Xcode project parsing, 24-character ID generation, group mutation and write/reparse preservation. Full native acceptance remains required because project tooling and native Expo modules changed.

## Native test-helper correction discovered during verification

The first exact-head iOS simulator run at `91d41bf` compiled and reached package-flow setup, then Maestro reported that `Saved on this device` was not visible. Its failure screenshot and captured accessibility hierarchy both show that exact text fully visible near the bottom of the page. The shared reveal helper requested `centerElement: true`; [Maestro's documented behaviour](https://docs.maestro.dev/reference/commands-available/scrolluntilvisible) adds a positional requirement beyond visibility, which a footer with insufficient content below it may not meet.

The helper now explicitly requires **100% visibility**, with `centerElement: false`. The 20-second timeout, selectors, activity answers, grading/persistence assertions and flow order are unchanged; no retries added. A configuration regression test guards that distinction. This is a supporting test-harness correction, not an application/storage workaround; fresh exact-head native acceptance must verify it before claiming success. The earlier failed run remains part of the evidence.

## Remaining security findings

Read-only `npm audit --omit=dev --json` on this lockfile still exits 1: **15 affected package nodes, all high**, propagated from two root advisories. This improves on the previous 18 nodes (15 high, 3 moderate); it does not mean the remaining high findings are fixed or accepted.

- `braces` stack-exhaustion denial of service, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); affected through 3.0.3, no patched braces version reported by the advisory when inspected.
- `node-forge` RSA PKCS#1 v1.5 signature verification, [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv); affected through 1.4.0, no patched node-forge version reported by the advisory when inspected.

Dependency paths are through Expo CLI/code-signing/Metro tooling. npm labels them production dependencies because Expo itself is in `dependencies`; this is not proof of exploitable paths in an installed APK. Neither is the tooling path alone proof of no installed-app exposure. Bundle/reachability and development/build-environment threat review remain open. Do not import untrusted signing material, expose Metro publicly, or interpret this note as a risk waiver. Audit's suggested downgrade to Expo 44 is not a compatible remediation and was not applied.

Repeat verification:

```sh
npm ci
npx expo install --check
npm run typecheck
npm test
npm run contract:check
npm run build:web
npm run test:browser
# Generation only; neither command installs pods or signs/distributes an app:
npx expo prebuild --platform ios --no-install
npx expo prebuild --platform android --no-install
npm audit --omit=dev --json # expected nonzero while the two high root advisories remain
```

These findings do not close identity/version, rights/privacy, signed AAB/certificate, target API/16 KB library compatibility, physical-device or Play Console gates. Native CI results must name the exact head separately; local iOS prebuild on Linux is not an iOS compile/device test.
