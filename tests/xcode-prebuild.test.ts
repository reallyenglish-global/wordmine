import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const xcode = require('xcode');

test('locked Expo config plugin uses its upstream Xcode dependency without vulnerable uuid', () => {
  const { packages } = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const plugin = packages['node_modules/@expo/config-plugins'];
  // Use the upstream-compatible SDK 57 patch, not a forced xcode/uuid override.
  assert.equal(plugin.dependencies.xcode, '^4.0.0');
  assert.equal(packages['node_modules/xcode'].dependencies.uuid, undefined);
  for (const [path, entry] of Object.entries(packages) as [string, { version: string }][]) {
    if (!path.endsWith('/uuid')) continue;
    const [major, minor, patch] = entry.version.split('.').map(Number);
    assert.ok(major > 11 || (major === 11 && (minor > 1 || (minor === 1 && patch >= 1))), `${path}@${entry.version} is below fixed uuid 11.1.1`);
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
