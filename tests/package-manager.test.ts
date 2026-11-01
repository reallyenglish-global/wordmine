import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

test('pnpm is pinned with a single frozen lockfile and Expo-compatible linker', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
  assert.ok(existsSync('pnpm-lock.yaml'));
  assert.equal(existsSync('package-lock.json'), false);
  assert.match(readFileSync('.npmrc', 'utf8'), /^node-linker=hoisted$/m);
  assert.deepEqual(pkg.pnpm.onlyBuiltDependencies, ['esbuild']);
});

for (const path of ['.github/workflows/ci.yml', '.github/workflows/android-aab-candidate.yml']) {
  test(`${path} installs pinned pnpm before Node's pnpm cache and freezes dependencies`, () => {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /\bnpm (?:ci|install|run|test)\b|\bnpx\b|cache: npm/);
    const workflow = parse(text);
    for (const [name, job] of Object.entries(workflow.jobs) as [string, any][]) {
      const steps = job.steps ?? [];
      const node = steps.findIndex((step: any) => step.uses?.startsWith('actions/setup-node@'));
      if (node < 0) continue; // Artifact-only emulator jobs do not install JS dependencies.
      const pnpm = steps.findIndex((step: any) => step.uses?.startsWith('pnpm/action-setup@'));
      assert.ok(pnpm >= 0 && pnpm < node, `${name}: setup pnpm before cache lookup`);
      assert.equal(steps[node].with.cache, 'pnpm');
      assert.ok(steps.some((step: any) => step.run === 'pnpm install --frozen-lockfile'), `${name}: frozen install`);
    }
  });
}
