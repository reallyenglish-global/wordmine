import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { cardsForList, readPackage, toActivityDocument } from '../src/package/reader';
import { encodeUtf8, hashBytes, parseJson } from '../src/package/bytes';
import { evaluate, normalizeSpelling } from '../src/package/evaluate';
import { syntheticFiles } from '../src/package/synthetic.generated';

const root = join(process.cwd(), 'contracts/pack-v0/fixtures/synthetic');
function fixture() {
  const files: Record<string, Uint8Array> = {};
  for (const path of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (path.isFile()) {
      const full = join(path.parentPath, path.name);
      files[relative(root, full).replaceAll('\\', '/')] = new Uint8Array(readFileSync(full));
    }
  }
  return files;
}
function edit(files: Record<string, Uint8Array>, name: string, change: (d: any) => void, integrity = true) {
  const doc = JSON.parse(new TextDecoder().decode(files[name])); change(doc);
  files[name] = encodeUtf8(JSON.stringify(doc));
  if (name !== 'manifest.json' && integrity) edit(files, 'manifest.json', m => {
    const entry = m.files.find((f: any) => f.path === name);
    entry.bytes = files[name].length; entry.sha256 = hashBytes(files[name]);
  });
}

test('bundled source bytes cannot drift from checked-in fixtures', () => {
  const bundled = Object.fromEntries(Object.entries(syntheticFiles).map(([path,data]) =>
    [path,typeof data === 'string' ? encodeUtf8(data) : Uint8Array.from(data)]));
  assert.deepEqual(bundled,fixture());
});

test('inherited manifests and empty normalized spelling aliases are rejected', () => {
  const files = fixture();
  const inherited = Object.assign(Object.create({'manifest.json':files['manifest.json']}),files);
  delete inherited['manifest.json'];
  assert.throws(() => readPackage(inherited), /manifest/);
  edit(files,'answers.json',d => d.items[1].accepted.push('\u0085'));
  assert.throws(() => readPackage(files), /spelling/);
});

test('resource bounds reject before hashing/parsing large payloads', () => {
  let files = fixture(); files['manifest.json'] = new Uint8Array(256*1024+1);
  assert.throws(() => readPackage(files), /manifest/);
  files = fixture(); edit(files,'manifest.json',m => m.files[0].bytes=129*1024*1024);
  assert.throws(() => readPackage(files), /resource/);
  files = fixture(); edit(files,'manifest.json',m => {m.files=Array(1025).fill(m.files[0]);});
  assert.throws(() => readPackage(files), /resource/);
  files = fixture(); files['words.json']=new Uint8Array(16*1024*1024+1);
  assert.throws(() => readPackage(files), /file/);
});

test('successful packages are frozen and malformed candidates cannot alter active content', () => {
  const files = fixture(); const active = readPackage(files);
  edit(files,'answers.json',d => d.items.pop());
  assert.throws(() => readPackage(files));
  assert.equal(active.cards.length,6);
  assert.ok(Object.isFrozen(active.cards[0]));
  assert.ok(Object.isFrozen(active.manifest));
});

test('reads exact fixture bytes, resolves deterministic cards and meaning activity adapter', () => {
  const p = readPackage(fixture());
  assert.equal(p.manifest.packageId, 'pack.synthetic-harbor');
  const cards = cardsForList(p, 'list.synthetic-harbor');
  assert.equal(cards.length, 6);
  assert.equal(cards[0].prompt.text, 'a sheltered place where boats can stay');
  assert.equal(cards[1].kind, 'spelling-from-definition');
  assert.deepEqual(cardsForList(p, 'list.synthetic-harbor'), cards);
  const document = toActivityDocument(p, cards[0].id, 'zh-Hans');
  assert.equal(document.languages.ui, 'zh-Hans');
  assert.equal(document.answerKey?.choiceId, 'choice.harbor');
  assert.throws(() => toActivityDocument(p, cards[1].id, 'en'), /spelling/);
  assert.throws(() => cardsForList(p, 'missing'), /list/);
});

const mutations: [string, string, (d: any) => void][] = [
  ['unknown contract','manifest.json', d => d.contract = 'wordmine.package.v99'],
  ['wrong version','words.json', d => d.contentVersion = '0.2.0'],
  ['unknown capability','manifest.json', d => d.requiredCapabilities.push('unknown@1')],
  ['missing capability','manifest.json', d => d.requiredCapabilities.pop()],
  ['traversal','manifest.json', d => d.files[0].path = '../words.json'],
  ['duplicate path','manifest.json', d => d.files.push(d.files[0])],
  ['duplicate role','manifest.json', d => d.files[1].role = 'lists'],
  ['unknown learner field','words.json', d => d.items[0].userItemId = 123],
  ['unknown word','lists.json', d => d.items[0].wordIds.push('word.missing')],
  ['duplicate membership','lists.json', d => d.items[0].wordIds.push('word.harbor')],
  ['unlisted word','lists.json', d => d.items[0].wordIds.pop()],
  ['duplicate word','words.json', d => d.items.push(d.items[0])],
  ['duplicate sense','words.json', d => d.items[0].senses.push(d.items[0].senses[0])],
  ['duplicate example','words.json', d => d.items[0].senses[0].examples.push(d.items[0].senses[0].examples[0])],
  ['wrong sense owner','questions.json', d => d.items[0].senseId = 'sense.lantern.1'],
  ['unknown target','questions.json', d => d.items[0].wordId = 'word.missing'],
  ['duplicate question','questions.json', d => d.items.push(d.items[0])],
  ['unknown question kind','questions.json', d => d.items[0].kind = 'listening'],
  ['duplicate choices','questions.json', d => d.items[0].choices[1].id = 'choice.harbor'],
  ['duplicate choice labels','questions.json', d => d.items[0].choices[1].label = d.items[0].choices[0].label],
  ['missing answer','answers.json', d => d.items.pop()],
  ['duplicate answer','answers.json', d => d.items.push(d.items[0])],
  ['unknown correct choice','answers.json', d => d.items[0].choiceId = 'choice.missing'],
  ['wrong correct choice','answers.json', d => d.items[0].choiceId = 'choice.lantern'],
  ['wrong spelling key','answers.json', d => d.items[1].accepted = ['wrong']],
  ['duplicate normalized key','answers.json', d => d.items[1].accepted = ['harbor', 'HARBOR']],
  ['missing image','words.json', d => d.items[0].senses[0].imageAssetIds.push('asset.missing')],
  ['image as pronunciation','words.json', d => d.items[0].pronunciation = {notation:'IPA',value:'test',audioAssetId:'asset.tile'}],
  ['markup','words.json', d => d.items[0].senses[0].definition.text = '<b>bad</b>'],
  ['wrong headword language','words.json', d => d.items[0].headword.lang = 'fr'],
  ['wrong prompt language','words.json', d => d.items[0].senses[0].definition.lang = 'fr'],
  ['wrong choice language','questions.json', d => d.items[0].choices[0].label.lang = 'fr'],
];
for (const [name,file,change] of mutations) test(`rejects ${name} after recomputing integrity`, () => {
  const files = fixture(); edit(files,file,change); assert.throws(() => readPackage(files));
});

test('integrity, missing files, extras, malformed UTF-8 and media signatures fail closed', () => {
  let f = fixture(); f['words.json'][10] ^= 1; assert.throws(() => readPackage(f), /checksum/);
  f = fixture(); delete f['assets/tile.png']; assert.throws(() => readPackage(f), /file/);
  f = fixture(); f['extra.txt'] = encodeUtf8('extra'); assert.throws(() => readPackage(f), /undeclared/);
  f = fixture(); f['manifest.json'] = new Uint8Array([0xff]); assert.throws(() => readPackage(f), /UTF-8/);
  f = fixture(); f['assets/tile.png'][0] = 0;
  edit(f,'manifest.json', d => d.files.find((e: any) => e.role === 'asset').sha256 = hashBytes(f['assets/tile.png']));
  assert.throws(() => readPackage(f), /media/);
});

test('strict JSON rejects duplicate/escaped keys, nonfinite numbers and excessive nesting', () => {
  for (const text of ['{"id":1,"id":2}', '{"id":1,"\\u0069d":2}', '{"x":1e999}', '['.repeat(70)+'0'+']'.repeat(70)])
    assert.throws(() => parseJson(encodeUtf8(text)));
  assert.deepEqual(parseJson(encodeUtf8('{"quote":"a\\\"b","items":[null,true,-2.5]}')), {quote:'a"b',items:[null,true,-2.5]});
});

test('portable UTF-8/hash agree with Node and require no DOM globals', () => {
  const names = ['TextEncoder','TextDecoder','Buffer'] as const;
  const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis,name));
  try {
    names.forEach(name => Reflect.deleteProperty(globalThis,name));
    assert.equal(hashBytes(encodeUtf8('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.deepEqual(parseJson(encodeUtf8('{"text":"中文 🌊 é"}')), {text:'中文 🌊 é'});
  } finally {
    names.forEach((name,i) => {if(descriptors[i]) Object.defineProperty(globalThis,name,descriptors[i]!);});
  }
});

test('English policy has pinned full Unicode folding but preserves accents/internal spaces', () => {
  for (const [input,expected] of [[' HARBOR ','harbor'],['Straße','strasse'],['ΟΣ','οσ'],['ﬀ','ff'],['e\u0301','é'],['\u0085HARBOR\u0085','harbor'],['\ufeffA','\ufeffa']])
    assert.equal(normalizeSpelling(input), expected);
  const cards = readPackage(fixture()).cards;
  assert.deepEqual(evaluate(cards[1], ' HARBOUR '), {accepted:true,correct:true});
  assert.deepEqual(evaluate(cards[1], 'hárbor'), {accepted:true,correct:false});
  assert.deepEqual(evaluate(cards[1], 'har bor'), {accepted:true,correct:false});
  assert.deepEqual(evaluate(cards[1], '   '), {accepted:false,correct:false});
  assert.deepEqual(evaluate(cards[0], 'choice.missing'), {accepted:false,correct:false});
  assert.deepEqual(evaluate(cards[0], 'choice.harbor'), {accepted:true,correct:true});
});
