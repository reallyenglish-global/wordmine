import * as generatedValidators from './validators.generated';
import { parseActivityDocument } from '../contract/parse';
import type { ActivityDocument, LocalizedText } from '../contract/schema';
import { hashBytes, parseJson, requireValid as check } from './bytes';
import { normalizeSpelling } from './evaluate';

type File = { role: string; path: string; mediaType: string; bytes: number; sha256: string; assetId?: string };
type Manifest = { packageId: string; contentVersion: string; title: LocalizedText; languages: {target: string; explanation: string}; requiredCapabilities: string[]; files: File[] };
type List = {id: string; title: LocalizedText; wordIds: string[]};
type Sense = {id: string; definition: LocalizedText; examples: {id: string; audioAssetId?: string}[]; imageAssetIds?: string[]};
type Word = {id: string; headword: LocalizedText; senses: Sense[]; pronunciation?: {audioAssetId?: string}};
type Question = {id: string; wordId: string; senseId: string; kind: PackageCard['kind']; choices?: {id: string; label: LocalizedText}[]};
type Key = {questionId: string; kind: string; choiceId?: string; accepted?: string[]};
export type PackageCard = {
  id: string; wordId: string; senseId: string; word: string; prompt: LocalizedText;
  kind: 'meaning-from-definition' | 'spelling-from-definition';
  choices: {id: string; label: LocalizedText}[]; choiceId?: string; accepted: string[];
};
export type ContentPackage = {manifest: Manifest; manifestHash: string; lists: List[]; words: Word[]; cards: PackageCard[]};

const validators = generatedValidators as Record<string,(value:unknown)=>boolean>;
function structural(value: unknown, role: string) {
  check(validators[role](value), `invalid ${role} schema`); // Never include raw document data in errors.
}
function index<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) { const id = key(item); check(!result.has(id), 'duplicate identity'); result.set(id,item); }
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

function parseManifest(manifestBytes: Uint8Array): Manifest {
  check(manifestBytes instanceof Uint8Array && manifestBytes.length <= 256 * 1024, 'missing/oversized manifest');
  const rawManifest = parseJson(manifestBytes); structural(rawManifest,'manifest');
  const manifest = rawManifest as Manifest;
  check(manifest.files.length <= 1024 && manifest.files.reduce((n,f) => n + f.bytes,0) <= 128 * 1024 * 1024, 'resource limits');
  const paths = new Set<string>(['manifest.json']);
  for (const entry of manifest.files) {
    check(!paths.has(entry.path) && entry.bytes <= 16 * 1024 * 1024, 'duplicate path or file size limit');
    paths.add(entry.path);
  }
  return manifest;
}

/** Validates a manifest before a transport uses its relative paths for requests. */
export function packagePayloadFiles(manifestBytes: Uint8Array): {path:string;bytes:number}[] {
  return parseManifest(manifestBytes).files.map(({path,bytes}) => ({path,bytes}));
}

/** Reads a caller-supplied byte map, not paths/ZIPs/URLs. No fetch, extraction or partial activation. */
export function readPackage(files: Record<string, Uint8Array>): ContentPackage {
  const manifestBytes = files['manifest.json'];
  check(Object.hasOwn(files,'manifest.json') && manifestBytes instanceof Uint8Array, 'missing manifest');
  const manifest = parseManifest(manifestBytes);
  const paths = new Set<string>(['manifest.json']);
  const assets = new Map<string, File>();
  const documents = new Map<string, unknown[]>();
  for (const entry of manifest.files) {
    check(!paths.has(entry.path), 'duplicate/reserved path'); paths.add(entry.path);
    const bytes = files[entry.path];
    check(Object.hasOwn(files,entry.path) && bytes instanceof Uint8Array && bytes.length <= 16 * 1024 * 1024, 'missing/oversized file');
    check(bytes.length === entry.bytes, 'file byte count');
    check(hashBytes(bytes) === entry.sha256, 'checksum mismatch');
    if (entry.role === 'asset') {
      check(entry.assetId && !assets.has(entry.assetId), 'duplicate asset'); assets.set(entry.assetId,entry);
      const signatures: Record<string, number[]> = {'image/png':[137,80,78,71,13,10,26,10], 'image/jpeg':[255,216,255], 'audio/wav':[82,73,70,70]};
      const signature = signatures[entry.mediaType];
      check(!signature || signature.every((byte,i) => bytes[i] === byte), 'asset media signature');
    } else {
      check(!documents.has(entry.role), 'duplicate document role');
      const raw = parseJson(bytes); structural(raw,entry.role);
      const doc = raw as {contentVersion: string; items: unknown[]};
      check(doc.contentVersion === manifest.contentVersion, 'mixed content versions'); documents.set(entry.role,doc.items);
    }
  }
  check(Object.keys(files).every(p => paths.has(p)), 'undeclared file');
  check(['lists','words','questions','answers'].every(role => documents.has(role)), 'missing document role');
  const lists = index(documents.get('lists') as List[], x => x.id);
  const words = index(documents.get('words') as Word[], x => x.id);
  const questions = index(documents.get('questions') as Question[], x => x.id);
  const answers = index(documents.get('answers') as Key[], x => x.questionId);
  const senses = new Map<string, {wordId: string; sense: Sense}>();
  const examples = new Set<string>();
  const asset = (id: string, media: string) => check(assets.get(id)?.mediaType.startsWith(media), 'missing/wrong asset reference');
  for (const word of words.values()) {
    check(word.headword.lang === manifest.languages.target, 'headword language');
    for (const sense of word.senses) {
      check(!senses.has(sense.id), 'duplicate sense'); senses.set(sense.id,{wordId:word.id,sense});
      for (const example of sense.examples) {
        check(!examples.has(example.id), 'duplicate example'); examples.add(example.id);
        if (example.audioAssetId) asset(example.audioAssetId,'audio/');
      }
      for (const id of sense.imageAssetIds ?? []) asset(id,'image/');
    }
    if (word.pronunciation?.audioAssetId) asset(word.pronunciation.audioAssetId,'audio/');
  }
  const listed = new Set<string>();
  for (const list of lists.values()) for (const id of list.wordIds) { check(words.has(id),'unknown list word'); listed.add(id); }
  check(listed.size === words.size, 'unlisted word');
  check(questions.size === answers.size && [...questions.keys()].every(id => answers.has(id)), 'missing/orphan answer');
  const capabilities = new Set<string>();
  const cards: PackageCard[] = [];
  for (const question of questions.values()) {
    const target = senses.get(question.senseId); const word = words.get(question.wordId); const key = answers.get(question.id)!;
    check(target && word && target.wordId === word.id, 'question word/sense reference');
    check(target.sense.definition.lang === manifest.languages.explanation, 'prompt language');
    check(key.kind === question.kind, 'answer kind'); capabilities.add(`${question.kind}@1`);
    if (question.kind === 'meaning-from-definition') {
      const choices = index(question.choices!, x => x.id);
      const normalized = question.choices!.map(c => normalizeSpelling(c.label.text));
      check(new Set(normalized).size === normalized.length, 'duplicate choice labels');
      check(question.choices!.every(c => c.label.lang === manifest.languages.target), 'choice language');
      const correct = choices.get(key.choiceId!);
      check(correct && correct.label.lang === word.headword.lang && correct.label.text === word.headword.text, 'correct choice label/reference');
    } else {
      check(manifest.languages.target.split('-')[0] === 'en', 'English spelling policy only');
      const normalized = key.accepted!.map(normalizeSpelling);
      check(normalized.every(Boolean) && new Set(normalized).size === normalized.length && normalized.includes(normalizeSpelling(word.headword.text)), 'spelling key');
    }
    cards.push({id:question.id,wordId:word.id,senseId:question.senseId,word:word.headword.text,prompt:target.sense.definition,
      kind:question.kind,choices:question.choices ?? [],choiceId:key.choiceId,accepted:key.accepted ?? []});
  }
  check(capabilities.size === manifest.requiredCapabilities.length && manifest.requiredCapabilities.every(c => capabilities.has(c)), 'capability mismatch');
  return freeze({manifest,manifestHash:hashBytes(manifestBytes),lists:[...lists.values()],words:[...words.values()],cards});
}

export function cardsForList(content: ContentPackage, listId: string): PackageCard[] {
  const list = content.lists.find(l => l.id === listId); check(list,'unknown list');
  return list.wordIds.flatMap(id => content.cards.filter(card => card.wordId === id));
}
export function toActivityDocument(content: ContentPackage, questionId: string, uiLanguage: string): ActivityDocument {
  const card = content.cards.find(c => c.id === questionId);
  check(card && card.kind === 'meaning-from-definition', 'activity adapter does not support spelling/unknown question');
  return parseActivityDocument({contract:'wordmine.activity.v0',contentVersion:content.manifest.contentVersion,
    languages:{...content.manifest.languages,ui:uiLanguage},
    activity:{id:card.id,kind:card.kind,prompt:card.prompt,choices:card.choices},
    answerKey:{activityId:card.id,kind:card.kind,choiceId:card.choiceId}});
}
