import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPracticeEngine} from '../src/engine/practice';
import {initialSession, packageStorageKey} from '../src/package/session';
import {readPackage} from '../src/package/reader';
import {syntheticFiles} from '../src/package/synthetic.generated';
import {encodeUtf8,hashBytes} from '../src/package/bytes';

const files = () => Object.fromEntries(Object.entries(syntheticFiles).map(([name,data]) =>
  [name,typeof data === 'string' ? encodeUtf8(data) : Uint8Array.from(data)]));
const content = readPackage(files());
const listId = content.lists[0].id;

test('engine locks first answers, rejects invalid input and resumes the existing session format', () => {
  const engine = createPracticeEngine(content,listId);
  const empty = engine.createSession();
  assert.equal(engine.storageKey,packageStorageKey(content,listId));
  assert.deepEqual(empty,initialSession(content,listId));
  assert.deepEqual(engine.advance(empty),empty);
  assert.deepEqual(engine.submit(empty,'invalid-choice'),empty);
  const answered = engine.submit(empty,'choice.meadow');
  assert.deepEqual(engine.submit(answered,'choice.harbor'),answered);
  assert.deepEqual(engine.restore(JSON.stringify(answered)),answered);
  assert.equal(engine.summary(answered).correct,0);
  assert.equal(engine.summary(answered).answered,1);
  assert.equal(engine.summary(answered).complete,false);
});

test('word feedback separates recognition and recall; unanswered is not an incorrect answer', () => {
  const engine = createPracticeEngine(content,listId);
  let state = engine.createSession();
  const fresh = engine.summary(state);
  assert.equal(fresh.words.length,3);
  assert.deepEqual(fresh.words[0].recognition,{answered:0,correct:0,total:1});
  assert.equal(fresh.words[0].needsPractice,false);
  state = engine.advance(engine.submit(state,'choice.meadow'));
  state = engine.advance(engine.submit(state,' HARBOUR '));
  const harbor = engine.summary(state).words[0];
  assert.equal(harbor.word,'harbor');
  assert.deepEqual(harbor.recognition,{answered:1,correct:0,total:1});
  assert.deepEqual(harbor.recall,{answered:1,correct:1,total:1});
  assert.equal(harbor.needsPractice,true);
  for (const card of engine.cards.slice(2)) state = engine.advance(engine.submit(state,card.choiceId ?? card.accepted[0]));
  const complete = engine.summary(state);
  assert.equal(complete.complete,true);
  assert.equal(complete.correct,5);
  assert.equal(complete.answered,6);
  assert.deepEqual(complete.words.filter(w => w.needsPractice).map(w => w.word),['harbor']);
  assert.deepEqual(engine.restore(JSON.stringify(state)),state);
  assert.deepEqual(engine.advance(state),state);
  assert.equal(engine.summary(engine.createSession()).answered,0);
});

test('engines isolate lists even when words overlap and refuse a foreign session', () => {
  const candidate = files();
  const lists = JSON.parse(new TextDecoder().decode(candidate['lists.json']));
  lists.items.push({id:'list.second',title:{lang:'en',text:'Second list'},wordIds:['word.lantern','word.harbor']});
  candidate['lists.json'] = encodeUtf8(JSON.stringify(lists));
  const manifest = JSON.parse(new TextDecoder().decode(candidate['manifest.json']));
  const entry = manifest.files.find((file:{path:string}) => file.path === 'lists.json');
  entry.bytes = candidate['lists.json'].length;
  entry.sha256 = hashBytes(candidate['lists.json']);
  candidate['manifest.json'] = encodeUtf8(JSON.stringify(manifest));
  const multi = readPackage(candidate);
  const first = createPracticeEngine(multi,listId);
  const second = createPracticeEngine(multi,'list.second');
  assert.equal(second.cards.length,4);
  assert.equal(second.cards[0].word,'lantern');
  assert.notEqual(first.storageKey,second.storageKey);
  const answered = first.submit(first.createSession(),'choice.harbor');
  assert.deepEqual(second.restore(JSON.stringify(answered)),second.createSession());
  assert.throws(() => second.submit(answered,'choice.lantern'),/another practice engine/);
  assert.throws(() => second.advance(answered),/another practice engine/);
  assert.throws(() => second.summary(answered),/another practice engine/);
  assert.throws(() => createPracticeEngine(content,'unknown'),/unknown list/);
  manifest.contentVersion='0.2.0';
  for (const file of manifest.files) {
    if (!file.path.endsWith('.json')) continue;
    const document = JSON.parse(new TextDecoder().decode(candidate[file.path]));
    document.contentVersion=manifest.contentVersion;
    candidate[file.path]=encodeUtf8(JSON.stringify(document));
    file.bytes=candidate[file.path].length;
    file.sha256=hashBytes(candidate[file.path]);
  }
  candidate['manifest.json'] = encodeUtf8(JSON.stringify(manifest));
  const upgraded = createPracticeEngine(readPackage(candidate),listId);
  assert.notEqual(upgraded.storageKey,first.storageKey);
  assert.deepEqual(upgraded.restore(JSON.stringify(answered)),upgraded.createSession());
});
