export type Choice = { id: string; label: string };
export type MeaningActivity = {
  id: string;
  kind: 'meaning-from-definition';
  definition: string;
  choices: Choice[];
  answerChoiceId: string;
};
export type PrototypeContract = {
  contract: 'wordmine.prototype.meaning-definition.v0';
  contentVersion: string;
  activity: MeaningActivity;
};

export function parsePrototypeContract(value: unknown): PrototypeContract {
  if (!value || typeof value !== 'object') throw new Error('Contract must be an object');
  const document = value as Record<string, unknown>;
  if (document.contract !== 'wordmine.prototype.meaning-definition.v0' ||
      typeof document.contentVersion !== 'string' || !document.contentVersion.trim()) {
    throw new Error('Unsupported contract or missing content version');
  }
  const activity = document.activity as Record<string, unknown> | null;
  if (!activity || typeof activity !== 'object' || activity.kind !== 'meaning-from-definition' ||
      typeof activity.id !== 'string' || !activity.id.trim() ||
      typeof activity.definition !== 'string' || !activity.definition.trim() ||
      !Array.isArray(activity.choices) || activity.choices.length < 2 ||
      !activity.choices.every((choice: unknown) => !!choice && typeof choice === 'object' &&
        typeof (choice as Choice).id === 'string' && !!(choice as Choice).id.trim() &&
        typeof (choice as Choice).label === 'string' && !!(choice as Choice).label.trim()) ||
      typeof activity.answerChoiceId !== 'string') {
    throw new Error('Invalid meaning activity');
  }
  const choices = activity.choices as Choice[];
  const ids = choices.map((choice) => choice.id);
  if (new Set(ids).size !== ids.length || !ids.includes(activity.answerChoiceId)) {
    throw new Error('Choices must have unique IDs and contain the answer');
  }
  return document as PrototypeContract;
}

export function checkAnswer(activity: MeaningActivity, choiceId: string): boolean {
  if (!activity.choices.some((choice) => choice.id === choiceId)) {
    throw new Error('Unknown choice');
  }
  return choiceId === activity.answerChoiceId;
}
