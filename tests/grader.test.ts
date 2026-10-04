import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GradingError, LocalAnswerKeyGrader, parseActivityDocument } from '../src/contract';
import { loadValidFixtures } from '../scripts/fixtures';

const fixture = loadValidFixtures().find((f) => f.name === 'meaning-definition.synthetic');
assert.ok(fixture);
const document = parseActivityDocument(fixture.value);
assert.ok(document.answerKey);
const grader = new LocalAnswerKeyGrader(document.answerKey);
const intent = (choiceId: string) => ({ type: 'submit-choice' as const, activityId: document.activity.id, choiceId });

test('correct choice yields a correct outcome with localized feedback', () => {
  const outcome = grader.grade(document.activity, intent('c2'));
  assert.equal(outcome.status, 'correct');
  assert.equal(outcome.selectedChoiceId, 'c2');
  assert.equal(outcome.answerChoiceId, 'c2');
  assert.deepEqual(outcome.feedback, { lang: 'en', text: 'Correct for this sample.' });
});

test('incorrect choice yields an incorrect outcome and reveals the answer', () => {
  const outcome = grader.grade(document.activity, intent('c1'));
  assert.equal(outcome.status, 'incorrect');
  assert.equal(outcome.answerChoiceId, 'c2');
  assert.equal(outcome.feedback?.text, 'Not this sample; try another choice.');
});

test('unknown choice and mismatched activity are grading errors', () => {
  assert.throws(() => grader.grade(document.activity, intent('unlisted')), GradingError);
  assert.throws(() => grader.grade(document.activity, { ...intent('c2'), activityId: 'other' }), GradingError);
});
