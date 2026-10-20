import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildJsonSchema, JSON_SCHEMA_PATH } from '../src/contract/jsonSchema';

const target = resolve(JSON_SCHEMA_PATH);
writeFileSync(target, `${JSON.stringify(buildJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${JSON_SCHEMA_PATH}`);
