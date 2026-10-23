import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const workflowFiles = ['.github/workflows/ci.yml', '.github/workflows/android-aab-candidate.yml'];
test('hosted workflows use Node 24 actions and pinned Ubuntu 24.04 runners', () => {
  for (const file of workflowFiles) {
    const workflow = readFileSync(file, 'utf8');
    assert.match(workflow, /runs-on: ubuntu-24[.]04/, `${file} must pin Ubuntu 24.04`);
    assert.doesNotMatch(workflow, /runs-on: ubuntu-latest/, `${file} must not use the migrating ubuntu-latest label`);
    assert.match(workflow, /actions\/checkout@v5/, `${file} must use Node 24-compatible checkout`);
    assert.match(workflow, /actions\/setup-node@v5/, `${file} must use Node 24-compatible setup-node`);
    assert.doesNotMatch(workflow, /actions\/checkout@v4|actions\/setup-node@v4/, `${file} must not retain Node 20 action versions`);
  }
});

const run = (config: unknown) => spawnSync('node', ['scripts/release-readiness.mjs'], {
  encoding: 'utf8',
  env: { ...process.env, WORDMINE_RELEASE_CONFIG: JSON.stringify(config) },
});

const valid = {
  applicationId: 'com.example.wordmine',
  version: '1.2.3',
  androidVersionCode: 12,
  iosBuildNumber: '12',
  rightsApproved: true,
  privacyApproved: true,
};

test('preview workflow is read-only, secret-free, labelled and preserves main prototype job', () => {
  const workflow = require('node:fs').readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  const preview = workflow.slice(workflow.indexOf('  android-preview:'), workflow.indexOf('  android-prototype:'));
  for (const expected of ['assembleRelease', 'sha256sum', 'source-sha.txt', 'build-metadata.json', 'if-no-files-found: error', 'retention-days: 7']) assert.ok(preview.includes(expected), `Preview pipeline missing ${expected}`);
  for (const forbidden of ['secrets.', 'upload-keystore', 'play-store', 'google-services']) assert.ok(!preview.includes(forbidden), `Preview pipeline must not access ${forbidden}`);
  assert.match(workflow, /android-prototype:\n    # Preserve the existing main-branch debug-prototype behavior/);
});

test('missing config returns actionable nonzero JSON without crashing', () => {
  const result = spawnSync('node', ['scripts/release-readiness.mjs'], {
    encoding: 'utf8', env: { ...process.env, WORDMINE_RELEASE_CONFIG: '' },
  });
  assert.equal(result.status, 2);
  assert.deepEqual(JSON.parse(result.stdout).errors, ['WORDMINE_RELEASE_CONFIG must contain a JSON object']);
});

test('prototype identity, absent build numbers and approvals cannot be store-ready', () => {
  const result = run({ ...valid, applicationId: 'com.reallyenglish.wordmine.prototype', androidVersionCode: undefined, iosBuildNumber: '', rightsApproved: false, privacyApproved: false });
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1);
  assert.equal(report.preview.ready, true);
  assert.equal(report.store.ready, false);
  assert.ok(report.store.blockers.includes('applicationId must not use the prototype identity'));
  assert.ok(report.store.blockers.includes('androidVersionCode must be a positive integer'));
  assert.ok(report.store.blockers.includes('iosBuildNumber must be a non-empty numeric string'));
  assert.ok(report.store.blockers.includes('rights approval is unresolved'));
  assert.ok(report.store.blockers.includes('privacy approval is unresolved'));
});

test('malformed JSON and malformed values fail closed', () => {
  const malformed = spawnSync('node', ['scripts/release-readiness.mjs'], { encoding: 'utf8', env: { ...process.env, WORDMINE_RELEASE_CONFIG: '{' } });
  assert.equal(malformed.status, 2);
  const invalid = run({ ...valid, version: 'latest', androidVersionCode: -1, rightsApproved: 'yes' });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).store.ready, false);
});

test('a synthetic candidate passes configuration checks but never claims Play release readiness', () => {
  const result = run(valid);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(report.configuration.ready, true);
  assert.equal(report.store.ready, false);
  assert.ok(report.store.blockers.includes('signed AAB and upload-certificate verification are pending'));
  assert.ok(report.store.blockers.includes('Play Console listing, declarations and track acceptance are pending'));
  assert.equal(report.publication.authorized, false);
});
