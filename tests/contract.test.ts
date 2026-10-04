import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContractValidationError, parseActivityDocument } from '../src/contract';
import { loadInvalidFixtures, loadValidFixtures } from '../scripts/fixtures';

const valid = loadValidFixtures();
const invalid = loadInvalidFixtures();

for (const fixture of valid) {
  test(`valid fixture ${fixture.name} parses`, () => {
    const document = parseActivityDocument(fixture.value);
    assert.equal(document.contract, 'wordmine.activity.v0');
    assert.ok(document.activity.choices.length >= 2);
  });
}

for (const fixture of invalid) {
  test(`invalid fixture ${fixture.name}: ${fixture.reason}`, () => {
    assert.throws(
      () => parseActivityDocument(fixture.document),
      (error: unknown) => {
        assert.ok(error instanceof ContractValidationError, 'expected ContractValidationError');
        const paths = error.issues.map((issue) => issue.path);
        assert.ok(
          paths.some((path) => path === fixture.expectedPath || path.startsWith(`${fixture.expectedPath}.`)),
          `expected an issue at ${fixture.expectedPath}, got ${paths.join(', ')}`,
        );
        return true;
      },
    );
  });
}

test('unknown fields are tolerated and stripped (additive versioning policy)', () => {
  const base = structuredClone(valid[0].value) as Record<string, unknown>;
  base.futureTopLevel = { anything: true };
  (base.activity as Record<string, unknown>).futureActivityField = 'x';
  const document = parseActivityDocument(base);
  assert.equal('futureTopLevel' in document, false);
  assert.equal('futureActivityField' in document.activity, false);
});

test('validation errors list every field-level issue', () => {
  const base = structuredClone(valid[0].value) as Record<string, unknown>;
  base.contentVersion = '';
  (base.languages as Record<string, unknown>).ui = '';
  try {
    parseActivityDocument(base);
    assert.fail('should throw');
  } catch (error) {
    assert.ok(error instanceof ContractValidationError);
    assert.deepEqual(error.issues.map((issue) => issue.path).sort(), ['contentVersion', 'languages.ui']);
    assert.match(error.message, /contentVersion: Must not be empty/);
  }
});

test('parse returns a copy, not the input object', () => {
  const input = structuredClone(valid[0].value);
  const document = parseActivityDocument(input);
  assert.notEqual(document, input);
  assert.notEqual(document.activity, (input as { activity: unknown }).activity);
});
