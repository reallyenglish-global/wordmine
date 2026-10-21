import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// These are shell control-flow tests with fake tools, NOT native runtime tests.
test('shared native entrypoint includes package grading, relaunch and original-state assertions', () => {
  const study = readFileSync('.maestro/study.yaml','utf8');
  assert.ok(/runFlow: package\.yaml/.test(study),'Shared native entrypoint must execute package.yaml');
  const flow = readFileSync('.maestro/package.yaml','utf8');
  for (const expected of ['clearState: true','Choose harbor','HARBOUR','stopApp','Package card 2 of 6','Check rejection example','Resume practice','package-original-preserved'])
    assert.ok(flow.includes(expected),`Native package flow missing ${expected}`);
  assert.match(flow,/helpers\/reveal\.yaml/);
  assert.ok(readFileSync('scripts/ci/ios-simulator.sh','utf8').includes('--test-output-dir native-results/maestro'),'iOS must retain actual failure artifacts too');
});
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
      writeFileSync(join(dir, 'bin/maestro'), '#!/bin/sh\nprintf "maestro\\n" >> "$CALLS"\nprintf "%s\\n" "$@" > "$MAESTRO_ARGS"\nexit "$MAESTRO_RC"\n', { mode: 0o755 });
      const result = spawnSync('bash', [resolve('scripts/ci/android-runtime.sh')], {
        cwd: dir, encoding: 'utf8',
        env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, CALLS: join(dir, 'calls'), MAESTRO_ARGS: join(dir,'maestro-args'), INSTALL_RC: `${install}`, MAESTRO_RC: `${maestro}`, DIAGNOSTICS_RC: `${diagnostics}` },
      });
      assert.equal(result.status, expected, result.stderr);
      if (install === 0) {
        const args = readFileSync(join(dir,'maestro-args'),'utf8').trim().split('\n');
        assert.equal(args[args.indexOf('--test-output-dir')+1],'native-results/maestro','Capture command metadata and failure screenshots, not only the debug log');
      }
      const calls = readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n');
      assert.deepEqual(calls, install === 0
        ? ['adb:install', 'maestro', 'adb:logcat', 'adb:exec-out']
        : ['adb:install', 'adb:logcat', 'adb:exec-out']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
