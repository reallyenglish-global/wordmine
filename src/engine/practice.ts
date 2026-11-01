import {cardsForList, type ContentPackage} from '../package/reader';
import {evaluate} from '../package/evaluate';
import {initialSession, next, packageStorageKey, restore, submit, type PackageSession} from '../package/session';

export type PracticeCounts = {answered:number; correct:number; total:number};
export type WordPractice = {
  wordId:string; word:string; recognition:PracticeCounts; recall:PracticeCounts; needsPractice:boolean;
};
export type PracticeSummary = PracticeCounts & {complete:boolean; words:WordPractice[]};

/** Local practice only. Pass validated readPackage output; never treat client results as course reporting. */
export function createPracticeEngine(content:ContentPackage,listId:string) {
  const cards = Object.freeze(cardsForList(content,listId));
  const storageKey = packageStorageKey(content,listId);
  function requireSession(session:PackageSession) {
    if (session.pin !== storageKey) throw new Error('Session belongs to another practice engine');
  }
  function summary(session:PackageSession):PracticeSummary {
    requireSession(session);
    const words = new Map<string,WordPractice>();
    let answered=0,correct=0;
    for (const card of cards) {
      let word = words.get(card.wordId);
      if (!word) {
        word = {wordId:card.wordId,word:card.word,recognition:{answered:0,correct:0,total:0},
          recall:{answered:0,correct:0,total:0},needsPractice:false};
        words.set(card.wordId,word);
      }
      const counts = card.kind === 'meaning-from-definition' ? word.recognition : word.recall;
      counts.total++;
      if (!Object.hasOwn(session.answers,card.id)) continue;
      const outcome = evaluate(card,session.answers[card.id]);
      if (!outcome.accepted) continue;
      answered++; counts.answered++;
      if (outcome.correct) {correct++;counts.correct++;} else word.needsPractice=true;
    }
    return {answered,correct,total:cards.length,complete:session.index === cards.length,words:[...words.values()]};
  }
  return Object.freeze({
    cards,storageKey,
    createSession:() => initialSession(content,listId),
    restore:(raw:string|null) => restore(raw,content,listId),
    submit:(session:PackageSession,answer:string) => {requireSession(session);return submit(session,[...cards],answer);},
    advance:(session:PackageSession) => {requireSession(session);return next(session,[...cards]);},
    summary,
  });
}
