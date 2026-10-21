import data from './casefold.unicode16.json';
import type { PackageCard } from './reader';

const folds = data.folds as Record<string, string>;
const whitespace = new Set(Array.from(data.whitespace));
/** en-nfc-trim-casefold-v1, Unicode 16.0.0; not legacy accent folding or Mandarin grading. */
export function normalizeSpelling(value: string): string {
  const chars = Array.from(value.normalize('NFC'));
  let start = 0, end = chars.length;
  while (start < end && whitespace.has(chars[start])) start++;
  while (end > start && whitespace.has(chars[end - 1])) end--;
  return chars.slice(start,end).map(c => Object.hasOwn(folds,c) ? folds[c] : c).join('');
}
export function evaluate(card: PackageCard, answer: string): {accepted: boolean; correct: boolean} {
  if (answer.length > 16384) return {accepted:false,correct:false};
  if (card.kind === 'meaning-from-definition') {
    return {accepted:card.choices.some(c => c.id === answer),correct:answer === card.choiceId};
  }
  const text = normalizeSpelling(answer);
  return {accepted:text.length > 0,correct:card.accepted.some(a => normalizeSpelling(a) === text)};
}
