import { z } from 'zod/v4';
import { ActivityDocumentSchema, CONTRACT_ID } from './schema';

export const JSON_SCHEMA_PATH = 'contracts/experimental-v0/activity.schema.json';

/** Builds the language-neutral JSON Schema that is committed next to the fixtures. */
export function buildJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(ActivityDocumentSchema, {
    target: 'draft-2020-12',
    // Input-side schema: unknown properties are allowed, matching the additive-versioning policy.
    io: 'input',
    unrepresentable: 'any',
  });
  // zod copies its registry metadata `id` into each definition; it is not a JSON Schema keyword and
  // strict validators such as Ajv reject it, so drop it (the definition name already carries it).
  for (const definition of Object.values((schema.$defs ?? {}) as Record<string, Record<string, unknown>>)) {
    delete definition.id;
  }
  return {
    $id: `https://github.com/reallyenglish-global/wordmine/${JSON_SCHEMA_PATH}`,
    title: `WordMine experimental activity document (${CONTRACT_ID})`,
    description:
      'Generated from src/contract/schema.ts by scripts/emit-schema.ts. Do not edit by hand. ' +
      'Cross-field rules (unique choice ids, answerKey matching the activity) are enforced by the TypeScript validator and the fixture corpus.',
    ...schema,
  };
}
