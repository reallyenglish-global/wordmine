import test from 'node:test';
import assert from 'node:assert/strict';
import { stripDebugReleaseSigning } from '../scripts/strip-debug-release-signing.mjs';

const template = `android {
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Default Expo template key is not allowed for this candidate.
            signingConfig signingConfigs.debug
            minifyEnabled false
            crunchPngs true
        }
    }
}`;

test('removes only the Expo release debug-key assignment and preserves debug signing', () => {
  const result = stripDebugReleaseSigning(template);
  assert.equal((result.match(/signingConfig signingConfigs\.debug/g) || []).length, 1);
  assert.match(result, /debug \{\n            signingConfig signingConfigs\.debug/);
  assert.match(result, /release \{\n            \/\/ Default Expo template key is not allowed for this candidate\./);
  assert.doesNotMatch(result.match(/release \{[\s\S]*?\n        \}/)?.[0] ?? '', /signingConfig/);
});

test('fails closed when the generated Expo release signing contract changed', () => {
  const changed = template.replace(/signingConfig signingConfigs\.debug\s+minifyEnabled/, 'minifyEnabled');
  assert.throws(() => stripDebugReleaseSigning(changed), /expected exactly two template debug signing assignments/);
  assert.throws(() => stripDebugReleaseSigning('android { buildTypes { release { minifyEnabled false } } }'), /release build type/);
});
