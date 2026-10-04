import type { ActivityDefinition, AnswerKey, LocalizedText } from './schema';

/** A typed learner action. Only choice submission exists in v0. */
export type ActivityIntent = { type: 'submit-choice'; activityId: string; choiceId: string };

/**
 * What the client needs to show feedback and, later, to report an attempt.
 * `answerChoiceId` is optional because a server-side grader may withhold it.
 */
export type ActivityOutcome = {
  activityId: string;
  status: 'correct' | 'incorrect';
  selectedChoiceId: string;
  answerChoiceId?: string;
  feedback?: LocalizedText;
};

/** Grading seam. The local implementation reads a bundled answer key; a later one may call wm-api. */
export interface Grader {
  grade(activity: ActivityDefinition, intent: ActivityIntent): ActivityOutcome;
}

export class GradingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GradingError';
  }
}

export class LocalAnswerKeyGrader implements Grader {
  constructor(private readonly key: AnswerKey) {}

  grade(activity: ActivityDefinition, intent: ActivityIntent): ActivityOutcome {
    if (intent.activityId !== activity.id || this.key.activityId !== activity.id) {
      throw new GradingError(`Intent, answer key and activity ids must agree (activity "${activity.id}")`);
    }
    if (!activity.choices.some((choice) => choice.id === intent.choiceId)) {
      throw new GradingError(`Unknown choice "${intent.choiceId}" for activity "${activity.id}"`);
    }
    const correct = intent.choiceId === this.key.choiceId;
    return {
      activityId: activity.id,
      status: correct ? 'correct' : 'incorrect',
      selectedChoiceId: intent.choiceId,
      answerChoiceId: this.key.choiceId,
      feedback: correct ? this.key.feedback?.correct : this.key.feedback?.incorrect,
    };
  }
}
