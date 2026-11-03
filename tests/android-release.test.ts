import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { configureAndroidBuild, verifyReleaseManifest } from '../scripts/android-release.mjs';
const config = JSON.parse(readFileSync('app.json', 'utf8')).expo;
test('permanent package is default, iOS is unchanged, prototype is explicit', () => {
  assert.equal(config.android.package, 'com.reallyenglish.wordmine');
  assert.equal(configureAndroidBuild(config, {}), config);
  const preview = configureAndroidBuild(config, { WORDMINE_ANDROID_PROTOTYPE: '1' });
  assert.equal(preview.android.package, 'com.reallyenglish.wordmine.prototype');
  assert.equal(preview.ios.bundleIdentifier, config.ios.bundleIdentifier);
  assert.equal(configureAndroidBuild(config, { WORDMINE_ANDROID_RELEASE_VERSION_CODE: '42' }).android.versionCode, 42);
  assert.throws(() => configureAndroidBuild(config, { WORDMINE_ANDROID_PROTOTYPE: '1', WORDMINE_ANDROID_RELEASE_VERSION_CODE: '42' }), /mutually exclusive/);
  for (const code of ['', '0', '-1', '01', '1.2', '1;echo unsafe', '2100000001']) {
    assert.throws(() => configureAndroidBuild(config, { WORDMINE_ANDROID_RELEASE_VERSION_CODE: code }), /positive safe integer/);
  }
});
test('actual Expo entrypoint composes permanent, release and prototype candidate configs', () => {
  const baseEnv = { ...process.env };
  for (const key of ['WORDMINE_ANDROID_PROTOTYPE', 'WORDMINE_ANDROID_RELEASE_VERSION_CODE', 'WORDMINE_ANDROID_VERSION_CODE']) delete baseEnv[key];
  for (const [env, expectedPackage, expectedCode] of [
    [{}, 'com.reallyenglish.wordmine', undefined],
    [{ WORDMINE_ANDROID_RELEASE_VERSION_CODE: '42' }, 'com.reallyenglish.wordmine', 42],
    [{ WORDMINE_ANDROID_PROTOTYPE: '1', WORDMINE_ANDROID_VERSION_CODE: '43' }, 'com.reallyenglish.wordmine.prototype', 43],
  ] as const) {
    const result = spawnSync(process.execPath, ['-e', "console.log(JSON.stringify(require('./app.config.js')({config:require('./app.json').expo})))"], { env: { ...baseEnv, ...env }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout);
    assert.equal(actual.android.package, expectedPackage);
    assert.equal(actual.android.versionCode, expectedCode);
    assert.equal(actual.ios.bundleIdentifier, config.ios.bundleIdentifier);
  }
});

test('release manifest rejects wrong identity, version, debug/testOnly and target API', () => {
  const xml = '<manifest package="com.reallyenglish.wordmine" android:versionCode="42"><uses-sdk android:targetSdkVersion="36"/><application android:debuggable="false"/></manifest>';
  assert.equal(verifyReleaseManifest(xml, '42').targetSdk, 36);
  assert.throws(() => verifyReleaseManifest(xml.replace('com.reallyenglish.wordmine', 'com.reallyenglish.wordmine.prototype'), '42'), /package mismatch/);
  assert.throws(() => verifyReleaseManifest(xml, '43'), /version code mismatch/);
  assert.throws(() => verifyReleaseManifest(xml.replace('debuggable="false"', 'debuggable="true"'), '42'), /debuggable/);
  assert.throws(() => verifyReleaseManifest(xml.replace('debuggable="false"', 'testOnly="true"'), '42'), /test-only/);
  assert.throws(() => verifyReleaseManifest(xml.replace('targetSdkVersion="36"', 'targetSdkVersion="35"'), '42'), /at least 36/);
});
test('signed release workflow is manual, human-gated, main-only and never uploads to Play', () => {
  const text = readFileSync('.github/workflows/android-signed-release.yml', 'utf8');
  const workflow = parse(text);
  const build = workflow.jobs['unsigned-build'];
  const signing = workflow.jobs['signed-artifacts'];
  assert.equal(signing.needs, 'unsigned-build');
  assert.equal(signing.environment, 'android-signing');
  assert.equal(build.environment, undefined);
  for (const job of [build, signing]) {
    assert.equal(job.if, "github.ref == 'refs/heads/main'");
    for (const step of job.steps) if (step.uses) assert.match(step.uses, /@[0-9a-f]{40}$/);
  }
  assert.ok(build.steps.some((step: { run?: string }) => step.run === 'npm ci --ignore-scripts'));
  assert.ok(signing.steps.some((step: { uses?: string }) => step.uses?.startsWith('actions/download-artifact@')));
  assert.ok(!signing.steps.some((step: { run?: string; uses?: string }) => /npm |gradlew|expo prebuild/.test(step.run ?? '') || /gradle\//.test(step.uses ?? '')));
  assert.ok(signing.steps.filter((step: { env?: object }) => step.env).length === 1);
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /if: github.ref == 'refs\/heads\/main'/);
  assert.match(text, /environment: android-signing/);
  assert.match(text, /:app:assembleRelease :app:bundleRelease/);
  assert.match(text, /scripts\/verify-aab-signature.py/);
  const verifier = readFileSync('scripts/verify-aab-signature.py', 'utf8');
  assert.match(verifier, /'-verify', '-strict'/);
  assert.match(verifier, /'jar verified\.'/);
  assert.match(text, /apksigner.*verify/);
  assert.match(text, /test "\$EXPECTED" = "\$ACTUAL"/);
  assert.match(text, /cmp "\$KEY_DIR\/expected.der" "\$KEY_DIR\/actual.der"/);
  assert.match(text, /trap .*EXIT/);
  const independentlyInspect = signing.steps.findIndex((step: { run?: string }) => step.run?.includes('verify-play-artifact.py unsigned-artifacts/app-release.aab'));
  const signIndex = signing.steps.findIndex((step: { env?: object }) => step.env);
  assert.ok(independentlyInspect >= 0 && independentlyInspect < signIndex, 'Inspect real AAB bytes before signing secrets');
  assert.match(text, /verify-play-artifact.py release-artifacts\/wordmine-release.aab/);
  assert.match(text, /--apk-manifest release-artifacts\/apk-manifest.xml/);
  assert.doesNotMatch(text, /cp unsigned-artifacts\/aab-manifest.xml/);
  assert.doesNotMatch(text, /upload-google-play|fastlane|service_account_json|pull_request_target/);
});
