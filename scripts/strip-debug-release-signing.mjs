import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEBUG_SIGNING_LINE = /^\s*signingConfig\s+signingConfigs\.debug\s*$/gm;

export function stripDebugReleaseSigning(gradleText) {
  if (typeof gradleText !== 'string' || !/^        release \{/m.test(gradleText)) {
    throw new Error('generated Gradle file has no expected release build type');
  }
  const matches = [...gradleText.matchAll(DEBUG_SIGNING_LINE)];
  if (matches.length !== 2) {
    throw new Error(`expected exactly two template debug signing assignments, found ${matches.length}`);
  }
  const release = gradleText.match(/^        release \{\r?\n[\s\S]*?^        \}/m);
  if (!release) throw new Error('could not isolate generated release build type');
  const releaseLines = [...release[0].matchAll(DEBUG_SIGNING_LINE)];
  if (releaseLines.length !== 1) {
    throw new Error(`expected exactly one release debug signing assignment, found ${releaseLines.length}`);
  }
  const line = releaseLines[0];
  const start = (release.index ?? 0) + line.index;
  const end = start + line[0].length;
  const stripped = `${gradleText.slice(0, start)}${gradleText.slice(end)}`;
  const remaining = [...stripped.matchAll(DEBUG_SIGNING_LINE)];
  if (remaining.length !== 1 || remaining[0].index >= (release.index ?? 0)) {
    throw new Error('failed to remove only the release debug signing assignment');
  }
  return stripped;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const gradlePath = process.argv[2];
    if (!gradlePath) throw new Error('Usage: node scripts/strip-debug-release-signing.mjs <android/app/build.gradle>');
    const resolvedPath = resolve(gradlePath);
    const original = readFileSync(resolvedPath, 'utf8');
    const stripped = stripDebugReleaseSigning(original);
    writeFileSync(resolvedPath, stripped);
    process.stdout.write('Removed Expo template debug signing from release only; debug signing unchanged.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
