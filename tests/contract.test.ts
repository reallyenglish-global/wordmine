import assert from 'node:assert/strict';
import { test } from 'node:test';
import example from '../contracts/experimental-v0/meaning-definition.example.json';
import { checkAnswer, parsePrototypeContract } from '../src/contract';

test('synthetic contract validates and accepts only the correct choice', () => {
  const contract = parsePrototypeContract(example);
  assert.equal(checkAnswer(contract.activity, 'c2'), true);
  assert.equal(checkAnswer(contract.activity, 'c1'), false);
  assert.throws(() => checkAnswer(contract.activity, 'unlisted'), /Unknown choice/);
});

test('rejects duplicate IDs, missing answer, and unsupported contract', () => {
  const copy = () => structuredClone(example);
  const duplicate = copy();
  duplicate.activity.choices[1].id = 'c1';
  assert.throws(() => parsePrototypeContract(duplicate), /unique IDs/);
  const missing = copy();
  missing.activity.answerChoiceId = 'nonexistent';
  assert.throws(() => parsePrototypeContract(missing), /contain the answer/);
  const unknown: { contract: string } = copy();
  unknown.contract = 'some-future-contract';
  assert.throws(() => parsePrototypeContract(unknown), /Unsupported contract/);
});
