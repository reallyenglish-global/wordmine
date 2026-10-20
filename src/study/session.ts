import { buildCards, type Card, type Pack } from './pack';

export type Session = {
  schema: 1; packId: string; packVersion: string; index: number;
  results: Record<string, { answer: string; correct: boolean }>;
};
export const storageKey = (pack: Pack) => `wm-next:study:${encodeURIComponent(pack.id)}:${encodeURIComponent(pack.version)}`;
export function createSession(pack: Pack): Session {
  return { schema: 1, packId: pack.id, packVersion: pack.version, index: 0, results: {} };
}
export function submitAnswer(state: Session, cards: Card[], answer: string): Session {
  const card = cards[state.index];
  if (!card || state.results[card.id] || !answer.trim()) return state;
  const correct = card.kind === 'spelling-definition'
    ? answer.trim().normalize('NFC').toLocaleLowerCase('en') === card.answer.normalize('NFC').toLocaleLowerCase('en')
    : answer === card.answer;
  return { ...state, results: { ...state.results, [card.id]: { answer, correct } } };
}
export function advance(state: Session, cards: Card[]): Session {
  const card = cards[state.index];
  return card && state.results[card.id] ? { ...state, index: state.index + 1 } : state;
}
export function restoreSession(raw: string | null, pack: Pack): Session {
  const empty = createSession(pack);
  if (!raw) return empty;
  try {
    const state = JSON.parse(raw) as Session;
    const cards = buildCards(pack);
    if (state.schema !== 1 || state.packId !== pack.id || state.packVersion !== pack.version || !Number.isInteger(state.index) || state.index < 0 || state.index > cards.length || !state.results || typeof state.results !== 'object' || Array.isArray(state.results)) return empty;
    const allowed = cards.slice(0, Math.min(state.index + 1, cards.length)).map(c => c.id);
    if (Object.keys(state.results).some(id => !allowed.includes(id))) return empty;
    let rebuilt = empty;
    for (let i = 0; i <= state.index && i < cards.length; i++) {
      const result = state.results[cards[i].id];
      if (!result) { if (i < state.index) return empty; break; }
      if (typeof result.answer !== 'string' || !result.answer.trim() || typeof result.correct !== 'boolean') return empty;
      rebuilt = submitAnswer(rebuilt, cards, result.answer);
      if (rebuilt.results[cards[i].id].correct !== result.correct) return empty;
      if (i < state.index) rebuilt = advance(rebuilt, cards);
    }
    return rebuilt;
  } catch { return empty; }
}
