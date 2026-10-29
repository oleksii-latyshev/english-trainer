import { expect, it } from 'bun:test';
import type { ExerciseView, RunView } from '@/core/mistakes';
import { firstOpenPosition, isLastPosition, isSummary, positionOf } from './index';

function item(position: number, answered: boolean): ExerciseView {
  return {
    position,
    mistake_id: position + 1,
    step: 3,
    rule_key: null,
    question: 'Where do you work?',
    said: null,
    sentence: null,
    result: answered
      ? {
          attempt_id: position + 10,
          outcome: 'pass',
          note: 'Right.',
          keep: 'I work here.',
          lesson: '',
          can_check: false,
          retried: false,
          retry_note: null,
          check_failed: false,
        }
      : null,
  };
}

function run(answered: readonly boolean[], finished = false): RunView {
  return {
    run_id: 1,
    kind: 'due',
    finished,
    items: answered.map((isAnswered, index) => item(index, isAnswered)),
  };
}

it('resumes at the first exercise without an answer', () => {
  expect(firstOpenPosition(run([true, true, false, false]))).toBe(2);
  expect(positionOf(run([true, false]), null)).toBe(1);
});

it('keeps the pinned exercise until the learner moves on', () => {
  expect(positionOf(run([true, true, false]), 0)).toBe(0);
});

it('shows the summary when every exercise is answered or the run is finished', () => {
  expect(isSummary(run([true, true]), null)).toBe(true);
  expect(isSummary(run([true, false]), null)).toBe(false);
  expect(isSummary(run([true, false], true), 0)).toBe(true);
  expect(isSummary(run([true, true]), 1)).toBe(false);
});

it('knows the last exercise', () => {
  expect(isLastPosition(run([false, false]), 1)).toBe(true);
  expect(isLastPosition(run([false, false]), 0)).toBe(false);
});
