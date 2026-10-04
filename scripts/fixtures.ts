import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const FIXTURE_ROOT = resolve('contracts/experimental-v0/fixtures');

export type InvalidFixture = { name: string; reason: string; expectedPath: string; document: unknown };

function readJsonDir(dir: string): { name: string; value: unknown }[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({ name: file.replace(/\.json$/, ''), value: JSON.parse(readFileSync(join(dir, file), 'utf8')) }));
}

export function loadValidFixtures(): { name: string; value: unknown }[] {
  return readJsonDir(join(FIXTURE_ROOT, 'valid'));
}

export function loadInvalidFixtures(): InvalidFixture[] {
  return readJsonDir(join(FIXTURE_ROOT, 'invalid')).map(({ name, value }) => {
    const record = value as Partial<InvalidFixture>;
    if (typeof record.reason !== 'string' || typeof record.expectedPath !== 'string' || !('document' in record)) {
      throw new Error(`Invalid fixture ${name} must have reason, expectedPath and document`);
    }
    return { name, reason: record.reason, expectedPath: record.expectedPath, document: record.document };
  });
}
