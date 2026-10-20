import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { buildJsonSchema, JSON_SCHEMA_PATH } from '../src/contract/jsonSchema';

test('committed JSON Schema matches the TypeScript schema', () => {
  const committed = JSON.parse(readFileSync(resolve(JSON_SCHEMA_PATH), 'utf8'));
  assert.deepEqual(committed, JSON.parse(JSON.stringify(buildJsonSchema())));
});

test('JSON Schema declares the envelope and the kind discriminator', () => {
  const schema = buildJsonSchema() as { properties: Record<string, unknown>; required: string[] };
  assert.deepEqual(schema.required, ['contract', 'contentVersion', 'languages', 'activity']);
  assert.ok('answerKey' in schema.properties);
  assert.match(JSON.stringify(schema), /"meaning-from-definition"/);
});
