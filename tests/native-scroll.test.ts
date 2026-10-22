import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('yaml');

test('native reveal helper requires full target visibility without imposing a footer centre position', () => {
  const source = readFileSync('.maestro/helpers/reveal.yaml', 'utf8');
  const commands = parse(source.split('\n---\n')[1]);
  assert.equal(commands.length, 2);
  const [anchor, target] = commands.map((command: { scrollUntilVisible: unknown }) => command.scrollUntilVisible);
  assert.equal(anchor.element.text, '${ANCHOR}');
  assert.equal(anchor.direction, 'UP');
  assert.equal(target.element.text, '${TARGET}');
  assert.equal(target.direction, 'DOWN');
  assert.equal(target.visibilityPercentage, 100);
  assert.equal(target.centerElement, false);
  assert.equal(target.timeout, 20000);
  // This guard verifies helper configuration only. Native exact-head acceptance
  // is still required to prove a real footer is found and all later checks run.
});
