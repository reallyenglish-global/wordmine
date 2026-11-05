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
  assert.deepEqual(pkg.pnpm.overrides, { glob: '^14.0.3', minimatch: '^11.0.1' });
  assert.equal(pkg.overrides, undefined, 'npm-only overrides must move to pnpm');
});

for (const path of ['.github/workflows/ci.yml', '.github/workflows/android-aab-candidate.yml', '.github/workflows/android-store-candidate.yml', '.github/workflows/android-signed-release.yml']) {
  test(`${path} installs pinned pnpm, freezes dependencies and preserves cache isolation`, () => {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /\bnpm (?:ci|install|run|test)\b|\bnpx\b|cache: npm/);
    const workflow = parse(text);
    for (const [name, job] of Object.entries(workflow.jobs) as [string, any][]) {
      const steps = job.steps ?? [];
      const node = steps.findIndex((step: any) => step.uses?.startsWith('actions/setup-node@'));
      if (node < 0) continue; // Artifact-only emulator jobs do not install JS dependencies.
      const pnpm = steps.findIndex((step: any) => step.uses?.startsWith('pnpm/action-setup@'));
      assert.ok(pnpm >= 0, `${name}: setup pnpm`);
      if (steps[node].with.cache) {
        assert.ok(pnpm < node, `${name}: setup pnpm before cache lookup`);
        assert.equal(steps[node].with.cache, 'pnpm');
      }
      assert.ok(steps.some((step: any) => /^pnpm install --frozen-lockfile(?: --ignore-scripts)?$/.test(step.run ?? '')), `${name}: frozen install`);
    }
  });
}

test('pnpm integration retains compatibility, low-threshold audit and Python security gates', () => {
  const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
  const commands = workflow.jobs.contracts.steps.map((step: any) => step.run).filter(Boolean);
  assert.ok(commands.includes('pnpm exec expo install --check'));
  assert.ok(commands.includes('pnpm audit --audit-level=low'));
  assert.ok(commands.includes("python3 -m unittest discover -s tests -p '*_test.py' -v"));
  for (const path of ['.github/workflows/android-store-candidate.yml', '.github/workflows/android-signed-release.yml']) {
    const build = parse(readFileSync(path, 'utf8')).jobs['unsigned-build'];
    assert.ok(build.steps.some((step: any) => step.run === 'pnpm install --frozen-lockfile --ignore-scripts'));
    assert.ok(build.steps.some((step: any) => step.run === 'pnpm audit --audit-level=low'));
  }
});
