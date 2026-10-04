import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { JSON_SCHEMA_PATH } from '../src/contract/jsonSchema';
import { loadInvalidFixtures, loadValidFixtures } from '../scripts/fixtures';

// Independent cross-check: a non-TypeScript consumer validating with the committed JSON Schema
// must agree with the TypeScript validator on every fixture, except for the cross-field rules
// that JSON Schema cannot express (flagged jsonSchemaDetects: false).
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(resolve(JSON_SCHEMA_PATH), 'utf8'));
const validate = ajv.compile(schema);

for (const fixture of loadValidFixtures()) {
  test(`JSON Schema accepts valid/${fixture.name}`, () => {
    assert.equal(validate(fixture.value), true, ajv.errorsText(validate.errors));
  });
}

for (const fixture of loadInvalidFixtures()) {
  test(`JSON Schema ${fixture.jsonSchemaDetects ? 'rejects' : 'cannot see'} invalid/${fixture.name}`, () => {
    const ok = validate(fixture.document);
    if (fixture.jsonSchemaDetects) {
      assert.equal(ok, false, 'expected the JSON Schema to reject this document');
      // Ajv reports a missing property on the parent; append it so paths compare with the fixture's expectedPath.
      const paths = (validate.errors ?? []).map((error) => {
        const base = error.instancePath.replace(/^\//, '').replace(/\//g, '.');
        const missing = error.keyword === 'required' ? String((error.params as { missingProperty?: string }).missingProperty ?? '') : '';
        return [base, missing].filter(Boolean).join('.');
      });
      const expected = fixture.expectedPath === '(root)' ? '' : fixture.expectedPath;
      assert.ok(
        paths.some((path) => path === expected || path.startsWith(`${expected}.`) || expected.startsWith(`${path}.`)),
        `expected an error near ${fixture.expectedPath}, got ${paths.join(', ') || '(none)'}`,
      );
    } else {
      assert.equal(ok, true, 'fixture flagged as TypeScript-only should pass JSON Schema; drop the flag if Ajv now detects it');
    }
  });
}
