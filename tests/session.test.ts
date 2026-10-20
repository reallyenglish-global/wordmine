import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSession, submitAnswer, advance, restoreSession, storageKey } from '../src/study/session';
import { parsePack, buildCards } from '../src/study/pack';
import { fixture } from './fixture';

const pack = parsePack(fixture);
const cards = buildCards(pack);

test('invalid, incompatible or internally inconsistent saved state safely starts fresh', () => {
  const empty = createSession(pack);
  const answered = submitAnswer(empty, cards, cards[0].answer);
  for (const raw of [null, '{', 'null', '[]', JSON.stringify({ ...empty, index: -1 }),
    JSON.stringify({ ...empty, index: 1 }), JSON.stringify({ ...empty, index: 99 }),
    JSON.stringify({ ...empty, results: null }),
    JSON.stringify({ ...answered, results: { [cards[0].id]: { answer: 'wrong', correct: true } } }),
    JSON.stringify({ ...answered, results: { rogue: { answer: 'x', correct: false } } }),
    JSON.stringify({ ...empty, packVersion: 'old' }),
  ]) assert.deepEqual(restoreSession(raw, pack), empty);
  assert.notEqual(storageKey(pack), storageKey({ ...pack, version: '2' }));
});

test('local session locks the first answer, resumes through JSON and completes without wraparound', () => {
  let state = createSession(pack);
  const wrong = submitAnswer(state, cards, 'wrong');
  assert.equal(wrong.results[cards[0].id].correct, false);
  assert.deepEqual(submitAnswer(wrong, cards, cards[0].answer), wrong);
  assert.deepEqual(advance(state, cards), state);
  state = restoreSession(JSON.stringify(wrong), pack);
  assert.deepEqual(state, wrong);
  state = advance(state, cards);
  assert.equal(state.index, 1);
  state = submitAnswer(state, cards, ' GLIMMER ');
  assert.equal(state.results[cards[1].id].correct, true);
  while (state.index < cards.length) state = advance(submitAnswer(state, cards, cards[state.index].answer), cards);
  assert.equal(state.index, cards.length);
  assert.equal(Object.keys(state.results).length, cards.length);
  assert.deepEqual(advance(state, cards), state);
  assert.deepEqual(submitAnswer(state, cards, 'anything'), state);
  assert.deepEqual(restoreSession(JSON.stringify(state), pack), state);
});
