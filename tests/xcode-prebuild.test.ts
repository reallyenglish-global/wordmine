import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const xcode = require('xcode');

test('locked Expo config plugin uses its upstream Xcode dependency without vulnerable uuid', () => {
  const { snapshots } = parse(readFileSync('pnpm-lock.yaml', 'utf8'));
  const plugins = Object.keys(snapshots).filter(key => key.startsWith('@expo/config-plugins@'));
  const xcodes = Object.keys(snapshots).filter(key => key.startsWith('xcode@'));
  const uuids = Object.keys(snapshots).filter(key => key.startsWith('uuid@'));
  assert.ok(plugins.length && xcodes.length, 'expected locked native dependencies');
  // Use the upstream-compatible Expo dependency, not a forced xcode/uuid override.
  for (const key of plugins) assert.match(snapshots[key].dependencies.xcode, /^4\./);
  for (const key of xcodes) assert.equal(snapshots[key].dependencies.uuid, undefined);
  for (const key of uuids) {
    const version = key.slice('uuid@'.length).split('(')[0];
    const [major, minor, patch] = version.split('.').map(Number);
    assert.ok(major > 11 || (major === 11 && (minor > 1 || (minor === 1 && patch >= 1))), `${key} is below fixed uuid 11.1.1`);
  }
});

test('Xcode prebuild dependency parses, generates project IDs, mutates and roundtrips a synthetic project', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wm-xcode-'));
  const file = join(directory, 'project.pbxproj');
  const groupId = 'AAAAAAAAAAAAAAAAAAAAAAAA';
  const projectId = 'BBBBBBBBBBBBBBBBBBBBBBBB';
  try {
    writeFileSync(file, `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
/* Begin PBXGroup section */
    ${groupId} = { isa = PBXGroup; children = (); sourceTree = "<group>"; };
/* End PBXGroup section */
/* Begin PBXProject section */
    ${projectId} = { isa = PBXProject; mainGroup = ${groupId}; targets = (); };
/* End PBXProject section */
  };
  rootObject = ${projectId};
}
`);
    const project = xcode.project(file);
    project.parseSync();
    const originalIds = project.allUuids();
    const generated = new Set<string>();
    for (let index = 0; index < 100; index++) {
      const id = project.generateUuid();
      assert.match(id, /^[0-9A-F]{24}$/);
      assert.ok(!originalIds.includes(id));
      assert.ok(!generated.has(id));
      generated.add(id);
    }
    const added = project.addPbxGroup([], 'Synthetic', 'Synthetic');
    assert.match(added.uuid, /^[0-9A-F]{24}$/);
    writeFileSync(file, project.writeSync());
    const restored = xcode.project(file);
    restored.parseSync();
    assert.equal(restored.hash.project.rootObject, projectId);
    assert.equal(restored.hash.project.objects.PBXProject[projectId].mainGroup, groupId);
    assert.equal(restored.hash.project.objects.PBXGroup[added.uuid].name, 'Synthetic');
    assert.ok(restored.allUuids().includes(added.uuid));
    for (const id of originalIds) assert.ok(restored.allUuids().includes(id));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
