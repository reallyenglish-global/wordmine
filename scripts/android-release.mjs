import { readFileSync } from 'node:fs';

export const ANDROID_PACKAGE = 'com.reallyenglish.wordmine';
/** @param {*} config @param {Record<string, string | undefined>} env */
export function configureAndroidBuild(config, env = process.env) {
  const prototype = env.WORDMINE_ANDROID_PROTOTYPE === '1';
  const releaseCode = env.WORDMINE_ANDROID_RELEASE_VERSION_CODE;
  if (prototype && releaseCode !== undefined) throw new Error('Release and prototype modes are mutually exclusive');
  if (prototype) return { ...config, android: { ...config.android, package: `${ANDROID_PACKAGE}.prototype` } };
  if (config.android?.package !== ANDROID_PACKAGE) throw new Error('Permanent Android package mismatch');
  if (releaseCode === undefined) return config;
  if (!/^[1-9]\d*$/.test(releaseCode) || !Number.isSafeInteger(Number(releaseCode)) || Number(releaseCode) > 2100000000) {
    throw new Error('Release version code must be a positive safe integer <= 2100000000');
  }
  return { ...config, android: { ...config.android, versionCode: Number(releaseCode) } };
}

export function verifyReleaseManifest(xml, expectedVersionCode) {
  const root = xml.match(/<manifest\b[^>]*>/)?.[0] ?? '';
  const app = xml.match(/<application\b[^>]*>/)?.[0] ?? '';
  const sdk = xml.match(/<uses-sdk\b[^>]*>/)?.[0] ?? '';
  const attr = (text, name) => text.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  if (attr(root, 'package') !== ANDROID_PACKAGE) throw new Error('Release package mismatch');
  if (attr(root, 'android:versionCode') !== String(expectedVersionCode)) throw new Error('Release version code mismatch');
  if (!app || /android:(debuggable|testOnly)="(true|1)"/.test(app)) throw new Error('Release must not be debuggable or test-only');
  const targetSdk = Number(attr(sdk, 'android:targetSdkVersion'));
  if (!Number.isInteger(targetSdk) || targetSdk < 36) throw new Error('Release target API must be at least 36');
  return { applicationId: ANDROID_PACKAGE, versionCode: Number(expectedVersionCode), targetSdk, debuggable: false };
}

if (process.argv[1]?.endsWith('/android-release.mjs')) {
  const [, , manifest, code] = process.argv;
  if (!manifest || !code) throw new Error('Usage: node scripts/android-release.mjs <manifest.xml> <versionCode>');
  console.log(JSON.stringify(verifyReleaseManifest(readFileSync(manifest, 'utf8'), code), null, 2));
}
