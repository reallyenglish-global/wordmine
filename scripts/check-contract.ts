import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkAnswer, parsePrototypeContract } from '../src/contract';

const fixture = JSON.parse(readFileSync(resolve('contracts/experimental-v0/meaning-definition.example.json'), 'utf8'));
const contract = parsePrototypeContract(fixture);
assert.equal(contract.activity.kind, 'meaning-from-definition');
assert.equal(checkAnswer(contract.activity, contract.activity.answerChoiceId), true);
console.log('Experimental synthetic contract and answer boundary validated');
