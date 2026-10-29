import { expect, it } from 'bun:test';
import type { ExerciseResult, ExerciseView } from '@/core/mistakes';
import { canTryOnceMore, exercisePhase } from './index';

const RESULT: ExerciseResult = {
  attempt_id: 1,
  outcome: 'miss',
  note: '',
  keep: 'I work here.',
  lesson: '',
  can_check: false,
  retried: false,
  retry_note: null,
  check_failed: false,
};

function exercise(result: Partial<ExerciseResult> | null): ExerciseView {
  return {
    position: 0,
    mistake_id: 1,
    step: 2,
    rule_key: null,
    question: '',
    said: null,
    sentence: null,
    result: result === null ? null : { ...RESULT, ...result },
  };
}

it('names the phase of an exercise from its result', () => {
  expect(exercisePhase(exercise(null))).toBe('open');
  expect(exercisePhase(exercise({ outcome: 'pass' }))).toBe('passed');
  expect(exercisePhase(exercise({ outcome: 'miss' }))).toBe('missed');
  expect(exercisePhase(exercise({ outcome: 'checking' }))).toBe('checking');
  expect(exercisePhase(exercise({ outcome: 'checking', check_failed: true }))).toBe('check-failed');
});

it('offers one free retry after a miss', () => {
  expect(canTryOnceMore(exercise({ outcome: 'miss' }))).toBe(true);
  expect(canTryOnceMore(exercise({ outcome: 'miss', retried: true }))).toBe(false);
  expect(canTryOnceMore(exercise({ outcome: 'pass' }))).toBe(false);
  expect(canTryOnceMore(exercise(null))).toBe(false);
});
