import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAabCandidateConfig, resolveExpoConfig, verifyAabManifestXml, verifyUnsignedAabEntries } from '../scripts/android-aab-candidate.mjs';

const prototypeConfig = {
  name: 'WordMine Next',
  version: '0.1.0',
  android: { package: 'com.reallyenglish.wordmine.prototype' },
  ios: { bundleIdentifier: 'com.reallyenglish.wordmine.prototype' },
};

test('candidate config sets a run-scoped Android version code without changing prototype identity', () => {
  const candidate = createAabCandidateConfig(prototypeConfig, '42');
  assert.equal(candidate.android.versionCode, 42);
  assert.equal(candidate.android.package, prototypeConfig.android.package);
  assert.equal(candidate.ios.bundleIdentifier, prototypeConfig.ios.bundleIdentifier);
  assert.equal(candidate.version, prototypeConfig.version);
  assert.equal('versionCode' in prototypeConfig.android, false);
});

test('candidate config rejects invalid version codes', () => {
  for (const value of ['', '0', '-1', '1.5', '01', 'abc', '2100000001']) {
    assert.throws(() => createAabCandidateConfig(prototypeConfig, value), /positive safe integer/);
  }
});

test('candidate config refuses any app identity other than the prototype', () => {
  const productionLike = structuredClone(prototypeConfig);
  productionLike.android.package = 'com.reallyenglish.wordmine';
  assert.throws(() => createAabCandidateConfig(productionLike, '42'), /prototype identity/);
});

test('Expo config leaves normal builds unchanged and applies only an explicit candidate version code', () => {
  assert.equal(resolveExpoConfig(prototypeConfig, { ...process.env, WORDMINE_ANDROID_VERSION_CODE: undefined }), prototypeConfig);
  const candidate = resolveExpoConfig(prototypeConfig, { ...process.env, WORDMINE_ANDROID_VERSION_CODE: '42' });
  assert.equal(candidate.android.versionCode, 42);
  assert.equal('versionCode' in prototypeConfig.android, false);
});

test('AAB structure requires the core App Bundle entries, Android code, and study app bundle', () => {
  const validEntries = [
    'BundleConfig.pb',
    'base/manifest/AndroidManifest.xml',
    'base/resources.pb',
    'base/assets.pb',
    'base/native.pb',
    'base/dex/classes.dex',
    'base/assets/index.android.bundle',
  ];
  assert.doesNotThrow(() => verifyUnsignedAabEntries(validEntries));
  assert.throws(() => verifyUnsignedAabEntries(['base/manifest/AndroidManifest.xml']), /required App Bundle entries/);
  assert.throws(() => verifyUnsignedAabEntries(['BundleConfig.pb', 'base/manifest/AndroidManifest.xml']), /required App Bundle entries/);
  for (const signature of ['META-INF/ANDROID.RSA', 'META-INF/ANDROID.DSA', 'META-INF/ANDROID.EC', 'META-INF/ANDROID.SF', 'META-INF/ANDROID.SIG', 'META-INF/MANIFEST.MF', 'meta-inf/key.rsa']) {
    assert.throws(() => verifyUnsignedAabEntries([...validEntries, signature]), /must be unsigned/);
  }
});

test('bundle manifest identity and version code must match the prototype candidate', () => {
  const manifest = '<manifest xmlns:android="http://schemas.android.com/apk/res/android" android:versionCode="42" android:versionName="0.1.0" package="com.reallyenglish.wordmine.prototype">';
  assert.deepEqual(verifyAabManifestXml(manifest, 42), {
    applicationId: 'com.reallyenglish.wordmine.prototype',
    appVersion: '0.1.0',
    androidVersionCode: 42,
  });
  assert.throws(() => verifyAabManifestXml(manifest.replace('com.reallyenglish.wordmine.prototype', 'com.reallyenglish.wordmine'), 42), /prototype identity/);
  assert.throws(() => verifyAabManifestXml(manifest.replace('versionCode="42"', 'versionCode="43"'), 42), /version code mismatch/);
  assert.throws(() => verifyAabManifestXml('<manifest package="com.reallyenglish.wordmine.prototype">', 42), /missing required manifest attributes/);
});

test('separate manual AAB candidate workflow builds but does not sign or upload', () => {
  const workflow = readFileSync('.github/workflows/android-aab-candidate.yml', 'utf8');
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.match(workflow, /WORDMINE_ANDROID_VERSION_CODE: \$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /:app:bundleRelease/);
  assert.match(workflow, /packages: platform-tools build-tools;36[.]0[.]0/);
  assert.match(workflow, /scripts\/strip-debug-release-signing\.mjs android\/app\/build\.gradle/);
  assert.match(workflow, /scripts\/aab-validator verifyAab dumpManifest/);
  assert.match(workflow, /-Pmanifest=.*RUNNER_TEMP/);
  const validator = readFileSync('scripts/aab-validator/build.gradle', 'utf8');
  assert.match(validator, /com[.]android[.]tools[.]build:bundletool:1[.]18[.]0/);
  assert.match(validator, /BundleToolMain/);
  assert.match(validator, /dump.*manifest/);
  assert.match(workflow, /scripts\/android-aab-candidate\.mjs verify/);
  assert.match(workflow, /wordmine-app-manifest/);
  assert.doesNotMatch(workflow, /upload-artifact|apksigner|keytool|jarsigner/);
});
