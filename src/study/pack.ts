export type Pack = {
  schema: 'wordmine.local-pack.v0'; id: string; version: string; language: string;
  title: string; provenance: string;
  entries: { id: string; word: string; senses: { id: string; definition: string }[] }[];
};
export type Card = {
  id: string; senseId: string; word: string; prompt: string;
  kind: 'meaning-choice' | 'spelling-definition';
  choices: { id: string; label: string }[]; answer: string;
};

export function parsePack(value: unknown): Pack {
  const pack = value as Pack;
  if (!pack || pack.schema !== 'wordmine.local-pack.v0' || !['id', 'version', 'language', 'title', 'provenance'].every(key => typeof pack[key as keyof Pack] === 'string' && (pack[key as keyof Pack] as string).trim().length > 0) || !Array.isArray(pack.entries) || pack.entries.length < 3) {
    throw new Error('Invalid local pack');
  }
  const ids = new Set<string>();
  const words = new Set<string>();
  for (const entry of pack.entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id) || typeof entry.word !== 'string' || !entry.word.trim() || words.has(entry.word.trim().toLowerCase()) || !Array.isArray(entry.senses) || !entry.senses.length) throw new Error('Invalid word entry');
    ids.add(entry.id); words.add(entry.word.trim().toLowerCase());
    for (const sense of entry.senses) {
      if (!sense || typeof sense.id !== 'string' || !sense.id.trim() || ids.has(sense.id) || typeof sense.definition !== 'string' || !sense.definition.trim()) throw new Error('Invalid sense');
      ids.add(sense.id);
    }
  }
  return pack;
}

export function buildCards(pack: Pack): Card[] {
  return pack.entries.flatMap((entry, index) => entry.senses.flatMap(sense => {
    const alternatives = pack.entries.filter(e => e.id !== entry.id).slice(0, 2);
    const choices = [alternatives[1], entry, alternatives[0]].map(e => ({ id: e.id, label: e.word }));
    // Stable position rotation avoids putting every answer in the same slot.
    for (let n = 0; n < index % choices.length; n++) choices.push(choices.shift()!);
    const base = { senseId: sense.id, word: entry.word, prompt: sense.definition };
    return [
      { ...base, id: `${sense.id}:meaning-choice`, kind: 'meaning-choice' as const, choices, answer: entry.id },
      { ...base, id: `${sense.id}:spelling-definition`, kind: 'spelling-definition' as const, choices: [], answer: entry.word },
    ];
  }));
}
