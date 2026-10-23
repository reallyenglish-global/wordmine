import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTOTYPE_ANDROID_ID = 'com.reallyenglish.wordmine.prototype';
const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

export function createAabCandidateConfig(config, versionCodeInput) {
  if (!config || typeof config !== 'object') throw new TypeError('Expo config must be an object');
  if (config.android?.package !== PROTOTYPE_ANDROID_ID || config.ios?.bundleIdentifier !== PROTOTYPE_ANDROID_ID) {
    throw new Error('AAB candidate build is restricted to the prototype identity');
  }
  if (typeof versionCodeInput !== 'string' || !/^[1-9]\d*$/.test(versionCodeInput)) {
    throw new Error('Android candidate version code must be a positive safe integer');
  }
  const versionCode = Number(versionCodeInput);
  if (!Number.isSafeInteger(versionCode) || versionCode > MAX_ANDROID_VERSION_CODE) {
    throw new Error('Android candidate version code must be a positive safe integer');
  }
  return { ...config, android: { ...config.android, versionCode } };
}

export function resolveExpoConfig(config, env = process.env) {
  const input = env.WORDMINE_ANDROID_VERSION_CODE;
  return input === undefined ? config : createAabCandidateConfig(config, input);
}

export function verifyUnsignedAabEntries(entries) {
  if (!Array.isArray(entries)) throw new Error('AAB candidate entry list is invalid');
  const required = [
    'BundleConfig.pb',
    'base/manifest/AndroidManifest.xml',
    'base/resources.pb',
    'base/assets.pb',
    'base/native.pb',
    'base/assets/index.android.bundle',
  ];
  const missing = required.filter((entry) => !entries.includes(entry));
  if (!entries.some((entry) => entry.startsWith('base/dex/classes') && entry.endsWith('.dex'))) {
    missing.push('base/dex/classes*.dex');
  }
  if (missing.length) throw new Error(`AAB candidate is missing required App Bundle entries: ${missing.join(', ')}`);
  const rootMetadata = entries.find((entry) => entry.toUpperCase().startsWith('META-INF/'));
  if (rootMetadata) throw new Error(`AAB candidate must be unsigned; root META-INF entry found: ${rootMetadata}`);
}

export function verifyAabManifestXml(xml, expectedVersionCode) {
  const expectedCode = Number(expectedVersionCode);
  if (typeof xml !== 'string' || !Number.isSafeInteger(expectedCode) || expectedCode <= 0 || expectedCode > MAX_ANDROID_VERSION_CODE) {
    throw new Error('AAB manifest or expected version code is invalid');
  }
  const root = xml.match(/<manifest\b[^>]*>/);
  const applicationId = root?.[0].match(/\bpackage="([^"]+)"/)?.[1];
  const versionCodeValue = root?.[0].match(/\bandroid:versionCode="([0-9]+)"/)?.[1];
  const appVersion = root?.[0].match(/\bandroid:versionName="([^"]+)"/)?.[1];
  if (!applicationId || !versionCodeValue || !appVersion) throw new Error('AAB manifest is missing required manifest attributes');
  if (applicationId !== PROTOTYPE_ANDROID_ID) throw new Error('AAB manifest application ID is not the WordMine prototype identity');
  const androidVersionCode = Number(versionCodeValue);
  if (!Number.isSafeInteger(androidVersionCode) || androidVersionCode !== expectedCode) {
    throw new Error(`AAB manifest version code mismatch: expected ${expectedCode}, found ${versionCodeValue}`);
  }
  return { applicationId, appVersion, androidVersionCode };
}

export function inspectUnsignedAab(aabPath, versionCodeInput, sourceSha, manifestXmlPath) {
  if (!/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error('source SHA must be a full 40-character Git commit');
  const stat = statSync(aabPath);
  if (!stat.isFile() || stat.size === 0) throw new Error('AAB candidate is missing or empty');
  const entries = execFileSync('unzip', ['-Z1', aabPath], { encoding: 'utf8' }).trim().split('\n');
  verifyUnsignedAabEntries(entries);
  const manifest = verifyAabManifestXml(readFileSync(manifestXmlPath, 'utf8'), versionCodeInput);
  const digest = createHash('sha256').update(readFileSync(aabPath)).digest('hex');
  return {
    ...manifest,
    sourceSha: sourceSha.toLowerCase(),
    artifact: aabPath,
    bytes: stat.size,
    sha256: digest,
    signed: false,
    storeReady: false,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [, , command, aabPath, versionCode, sourceSha, manifestXmlPath] = process.argv;
    if (command !== 'verify' || !aabPath || !versionCode || !sourceSha || !manifestXmlPath) {
      throw new Error('Usage: node scripts/android-aab-candidate.mjs verify <aab-path> <version-code> <source-sha> <bundletool-manifest-xml-path>');
    }
    const metadata = inspectUnsignedAab(aabPath, versionCode, sourceSha, manifestXmlPath);
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      writeFileSync(process.env.GITHUB_STEP_SUMMARY,
        `## WordMine unsigned Android AAB candidate\n\n` +
        `- Identity: \`${metadata.applicationId}\` (prototype only)\n` +
        `- Version: \`${metadata.appVersion}\` / versionCode \`${metadata.androidVersionCode}\`\n` +
        `- Source: \`${metadata.sourceSha}\`\n` +
        `- AAB: ${metadata.bytes} bytes; SHA-256 \`${metadata.sha256}\`\n` +
        `- Signing: unsigned; store ready: no\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
