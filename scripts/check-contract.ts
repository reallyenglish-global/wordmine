import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContractValidationError, LocalAnswerKeyGrader, parseActivityDocument } from '../src/contract';
import { buildJsonSchema, JSON_SCHEMA_PATH } from '../src/contract/jsonSchema';
import { loadInvalidFixtures, loadValidFixtures } from './fixtures';

let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};

const committed = JSON.parse(readFileSync(resolve(JSON_SCHEMA_PATH), 'utf8'));
if (JSON.stringify(committed) !== JSON.stringify(buildJsonSchema())) {
  fail(`${JSON_SCHEMA_PATH} is out of date; run npm run contract:schema`);
}

const valid = loadValidFixtures();
for (const fixture of valid) {
  try {
    const document = parseActivityDocument(fixture.value);
    if (document.answerKey) {
      const outcome = new LocalAnswerKeyGrader(document.answerKey).grade(document.activity, {
        type: 'submit-choice',
        activityId: document.activity.id,
        choiceId: document.answerKey.choiceId,
      });
      if (outcome.status !== 'correct') fail(`valid/${fixture.name}: answer key does not grade as correct`);
    }
  } catch (error) {
    fail(`valid/${fixture.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const invalid = loadInvalidFixtures();
for (const fixture of invalid) {
  try {
    parseActivityDocument(fixture.document);
    fail(`invalid/${fixture.name}: parsed although it should fail (${fixture.reason})`);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) {
      fail(`invalid/${fixture.name}: threw ${String(error)} instead of ContractValidationError`);
    } else if (!error.issues.some((issue) => issue.path === fixture.expectedPath || issue.path.startsWith(`${fixture.expectedPath}.`))) {
      fail(`invalid/${fixture.name}: no issue at ${fixture.expectedPath}; got ${error.issues.map((i) => i.path).join(', ')}`);
    }
  }
}

if (failures > 0) {
  console.error(`${failures} contract check(s) failed`);
  process.exit(1);
}
console.log(`Contract OK: schema in sync, ${valid.length} valid and ${invalid.length} invalid fixtures behave as declared`);
