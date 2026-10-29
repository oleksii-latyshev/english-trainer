import { expect, it } from 'bun:test';
import type { ExerciseResult, ExerciseView, MistakeGroups, RunView } from '@/core/mistakes';
import { instruction, outcomeLabel, progressLabel, ruleTitleOf, tally, tallyLine } from './index';

function exercise(outcome: ExerciseResult['outcome'] | null, checkFailed = false): ExerciseView {
  return {
    position: 0,
    mistake_id: 1,
    step: 1,
    rule_key: 'articles',
    question: '',
    said: null,
    sentence: null,
    result:
      outcome === null
        ? null
        : {
            attempt_id: 1,
            outcome,
            note: '',
            keep: '',
            lesson: '',
            can_check: false,
            retried: false,
            retry_note: null,
            check_failed: checkFailed,
          },
  };
}

const RUN: RunView = {
  run_id: 1,
  kind: 'due',
  finished: false,
  items: [
    exercise('pass'),
    exercise('pass'),
    exercise('miss'),
    exercise('checking'),
    exercise(null),
  ],
};

it('counts how the exercises went', () => {
  expect(tally(RUN)).toEqual({ right: 2, missed: 1, checking: 1, open: 1 });
});

it('writes the summary line without scolding', () => {
  expect(tallyLine(tally(RUN), 5)).toBe('2 of 5 right · 1 to review · 1 still being checked');
  expect(tallyLine({ right: 3, missed: 0, checking: 0, open: 0 }, 3)).toBe('3 of 3 right');
});

it('labels each outcome', () => {
  expect(outcomeLabel(exercise('pass'))).toBe('Right');
  expect(outcomeLabel(exercise('miss'))).toBe('Not quite');
  expect(outcomeLabel(exercise('checking'))).toBe('Checking…');
  expect(outcomeLabel(exercise('checking', true))).toBe('Not checked');
  expect(outcomeLabel(exercise(null))).toBe('Not practised');
});

it('shows the position with the rule name when there is one', () => {
  expect(progressLabel(1, 6, 'Articles')).toBe('2 of 6 · Articles');
  expect(progressLabel(0, 3, null)).toBe('1 of 3');
});

it('finds a rule title in the groups', () => {
  const groups: MistakeGroups = {
    groups: [
      {
        rule_key: 'articles',
        title: 'Articles',
        summary: '',
        mistake_count: 2,
        fixed_count: 0,
        due_count: 0,
        relapse_count: 0,
        last_relapse_at: null,
        mistakes: [],
      },
    ],
    ungrouped: [],
    due_count: 0,
  };
  expect(ruleTitleOf(groups, 'articles')).toBe('Articles');
  expect(ruleTitleOf(groups, 'other')).toBeNull();
  expect(ruleTitleOf(null, 'articles')).toBeNull();
  expect(instruction(1)).toBe('Type the missing words.');
});
