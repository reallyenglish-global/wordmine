import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {test} from 'node:test';

test('package reader and full negative corpus work when string code generation is forbidden', () => {
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT; // Nested Node test runners must not inherit the parent's IPC test mode.
  const result = spawnSync(process.execPath, [
    '--disallow-code-generation-from-strings', '--import', 'tsx', '--test',
    'tests/package.test.ts', 'tests/package-session.test.ts',
  ], {env,encoding:'utf8',maxBuffer:4*1024*1024});
  assert.equal(result.status,0,`${result.stdout.slice(-1800)}\n${result.stderr.slice(-1800)}`);
  assert.match(result.stdout, /fail\s+0/);
});

test('default test suite guards deterministic validator output and rejects stale generated files', () => {
  const env = {...process.env}; delete env.NODE_TEST_CONTEXT;
  const script = resolve('scripts/generate-package-validators.ts');
  const command = ['--import',createRequire(resolve('package.json')).resolve('tsx'),script,'--check'];
  const current = spawnSync(process.execPath,command,{env,encoding:'utf8'});
  assert.equal(current.status,0,current.stderr);
  const dir = mkdtempSync(join(tmpdir(),'wm-static-validators-'));
  try {
    mkdirSync(join(dir,'src/package'),{recursive:true});
    const file = join(dir,'src/package/validators.generated.ts');
    writeFileSync(file,readFileSync('src/package/validators.generated.ts'));
    const same = spawnSync(process.execPath,command,{env,cwd:dir,encoding:'utf8'});
    assert.equal(same.status,0,same.stderr);
    writeFileSync(file,'// intentionally stale test output\n');
    const stale = spawnSync(process.execPath,command,{env,cwd:dir,encoding:'utf8'});
    assert.notEqual(stale.status,0);
    assert.match(stale.stderr,/validators drift/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
