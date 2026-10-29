import { expect, it } from 'bun:test';
import { ladderSteps, reachedSteps } from './index';

it('marks earlier steps done and the current one', () => {
  expect(ladderSteps(3, false).map((step) => step.state)).toEqual([
    'done',
    'done',
    'current',
    'todo',
  ]);
});

it('marks every step done once the mistake is fixed', () => {
  expect(ladderSteps(4, true).every((step) => step.state === 'done')).toBe(true);
  expect(reachedSteps(2, true)).toBe(4);
});

it('keeps the reached steps within the ladder', () => {
  expect(reachedSteps(0, false)).toBe(1);
  expect(reachedSteps(9, false)).toBe(4);
});
