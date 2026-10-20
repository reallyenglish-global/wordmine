import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePack, buildCards } from '../src/study/pack';

import { fixture } from './fixture';

test('one versioned word/sense pack generates recognition and recall cards without duplication', () => {
  const pack = parsePack(fixture);
  const cards = buildCards(pack);
  assert.equal(cards.length, 6);
  assert.deepEqual(cards.map(c => c.kind), ['meaning-choice', 'spelling-definition', 'meaning-choice', 'spelling-definition', 'meaning-choice', 'spelling-definition']);
  assert.equal(cards[0].senseId, cards[1].senseId);
  assert.equal(cards[0].prompt, 'A small, gentle light.');
  assert.deepEqual(cards[0].choices.map(c => c.label), ['wander', 'glimmer', 'shelter']);
  assert.equal(new Set(cards.map(c => c.id)).size, 6);
  assert.deepEqual(buildCards(pack), cards);
});

test('pack validation rejects malformed metadata, duplicate words/senses and too few distractors', () => {
  for (const bad of [
    { ...fixture, id: 42 }, { ...fixture, version: ' ' },
    { ...fixture, language: {} }, { ...fixture, provenance: [] },
    { ...fixture, entries: fixture.entries.slice(0, 2) },
    { ...fixture, entries: [fixture.entries[0], fixture.entries[0], fixture.entries[2]] },
    { ...fixture, entries: fixture.entries.map(e => ({ ...e, word: 'Same' })) },
    { ...fixture, entries: fixture.entries.map(e => ({ ...e, senses: [{ id: 'shared', definition: 'Example' }] })) },
  ]) assert.throws(() => parsePack(bad));
});
