import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPackage, cardsForList } from '../src/package/reader';
import { syntheticFiles } from '../src/package/synthetic.generated';
import { encodeUtf8 } from '../src/package/bytes';
import { initialSession, packageStorageKey, restore, submit, next } from '../src/package/session';
const files = Object.fromEntries(Object.entries(syntheticFiles).map(([name,data]) => [name, typeof data === 'string' ? encodeUtf8(data) : Uint8Array.from(data)]));
const content = readPackage(files);
const listId = content.lists[0].id;
const cards = cardsForList(content,listId);

test('package state pins manifest/content/list and preserves first answer', () => {
  const state = initialSession(content,listId);
  assert.ok(packageStorageKey(content,listId).includes(content.manifestHash));
  assert.ok(!packageStorageKey(content,listId).startsWith('wm-next:study:'));
  const answered = submit(state,cards,'choice.harbor');
  assert.deepEqual(submit(answered,cards,'choice.meadow'),answered);
  assert.deepEqual(submit(state,cards,'bad-choice'),state);
  assert.deepEqual(next(state,cards),state);
  assert.equal(next(answered,cards).index,1);
  assert.deepEqual(restore(JSON.stringify(answered),content,listId),answered);
});

test('restore rejects bad/future/orphan/foreign state, version changes and altered manifest pins', () => {
  const state = initialSession(content,listId);
  for (const raw of ['broken','null','[]',JSON.stringify({...state,index:2}),
    JSON.stringify({...state,pin:'foreign'}),JSON.stringify({...state,answers:{orphan:'x'}}),
    JSON.stringify({...state,answers:{[cards[0].id]:'not-a-choice'}})])
    assert.deepEqual(restore(raw,content,listId),state);
  const answered = submit(state,cards,'choice.harbor');
  for (const changed of [{...content,manifestHash:'0'.repeat(64)},
    {...content,manifest:{...content.manifest,contentVersion:'0.2.0'}}]) {
    assert.notEqual(packageStorageKey(changed,listId),packageStorageKey(content,listId));
    assert.deepEqual(restore(JSON.stringify(answered),changed,listId),initialSession(changed,listId));
  }
});

test('all cards complete and restored responses remain independently evaluable', () => {
  let state = initialSession(content,listId);
  for (const card of cards) state = next(submit(state,cards,card.choiceId ?? card.accepted[0]),cards);
  assert.equal(state.index,6);
  assert.equal(Object.keys(state.answers).length,6);
  assert.deepEqual(restore(JSON.stringify(state),content,listId),state);
});
