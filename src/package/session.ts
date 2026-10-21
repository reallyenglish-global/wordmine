import { cardsForList, type ContentPackage, type PackageCard } from './reader';
import { evaluate } from './evaluate';
import { encodeUtf8, parseJson } from './bytes';
export type PackageSession = {pin: string; index: number; answers: Record<string,string>};
export const packageStorageKey = (content: ContentPackage, listId: string) =>
  `wm-next:package-practice:${encodeURIComponent(content.manifest.packageId)}:${content.manifest.contentVersion}:${content.manifestHash}:${encodeURIComponent(listId)}`;
export const initialSession = (content: ContentPackage,listId: string): PackageSession =>
  ({pin:packageStorageKey(content,listId),index:0,answers:{}});
export function submit(state: PackageSession,cards: PackageCard[],answer: string): PackageSession {
  const card = cards[state.index];
  if (!card || Object.hasOwn(state.answers,card.id) || !evaluate(card,answer).accepted) return state;
  return {...state,answers:{...state.answers,[card.id]:answer}};
}
export function next(state: PackageSession,cards: PackageCard[]): PackageSession {
  const card = cards[state.index];
  return card && Object.hasOwn(state.answers,card.id) ? {...state,index:state.index+1} : state;
}
export function restore(raw: string|null,content: ContentPackage,listId: string): PackageSession {
  const empty = initialSession(content,listId);
  if (!raw || raw.length > 256 * 1024) return empty;
  try {
    const state = parseJson(encodeUtf8(raw)) as PackageSession;
    const cards = cardsForList(content,listId);
    if (!state || Object.keys(state).sort().join(',') !== 'answers,index,pin' || state.pin !== empty.pin ||
      !Number.isInteger(state.index) || state.index < 0 || state.index > cards.length || !state.answers ||
      typeof state.answers !== 'object' || Array.isArray(state.answers)) return empty;
    const allowed = new Set(cards.slice(0,Math.min(state.index+1,cards.length)).map(c => c.id));
    if (Object.keys(state.answers).some(id => !allowed.has(id))) return empty;
    let rebuilt = empty;
    for (let i=0; i<=state.index && i<cards.length; i++) {
      const card = cards[i];
      if (!Object.hasOwn(state.answers,card.id)) { if (i<state.index) return empty; break; }
      const answer = state.answers[card.id];
      if (typeof answer !== 'string' || !evaluate(card,answer).accepted) return empty;
      rebuilt = submit(rebuilt,cards,answer);
      if (i<state.index) rebuilt = next(rebuilt,cards);
    }
    return rebuilt;
  } catch { return empty; }
}
