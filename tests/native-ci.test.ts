import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// These are shell control-flow tests with fake tools, NOT native runtime tests.
for (const [label, install, maestro, diagnostics, expected] of [
  ['success', 0, 0, 0, 0],
  ['failed flow', 0, 7, 0, 7],
  ['failed install', 9, 0, 0, 9],
  ['failed diagnostics preserve success', 0, 0, 8, 0],
  ['failed diagnostics preserve flow failure', 0, 7, 8, 7],
] as const) {
  test(`Android wrapper: ${label}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'wm-native-ci-'));
    try {
      mkdirSync(join(dir, 'bin'));
      writeFileSync(join(dir, 'bin/adb'), '#!/bin/sh\nprintf "adb:%s\\n" "$1" >> "$CALLS"\ncase "$1" in install) exit "$INSTALL_RC";; *) exit "$DIAGNOSTICS_RC";; esac\n', { mode: 0o755 });
      writeFileSync(join(dir, 'bin/maestro'), '#!/bin/sh\nprintf "maestro\\n" >> "$CALLS"\nexit "$MAESTRO_RC"\n', { mode: 0o755 });
      const result = spawnSync('bash', [resolve('scripts/ci/android-runtime.sh')], {
        cwd: dir, encoding: 'utf8',
        env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, CALLS: join(dir, 'calls'), INSTALL_RC: `${install}`, MAESTRO_RC: `${maestro}`, DIAGNOSTICS_RC: `${diagnostics}` },
      });
      assert.equal(result.status, expected, result.stderr);
      const calls = readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n');
      assert.deepEqual(calls, install === 0
        ? ['adb:install', 'maestro', 'adb:logcat', 'adb:exec-out']
        : ['adb:install', 'adb:logcat', 'adb:exec-out']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
