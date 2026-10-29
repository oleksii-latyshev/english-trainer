import { expect, it } from 'bun:test';
import type { MistakeGroup, MistakeGroups, MistakeSummary } from '@/core/mistakes';
import {
  fixedLabel,
  fixedMistakes,
  moreLabel,
  overviewLine,
  practiseLabel,
  relapseLabel,
} from './index';

function summary(id: number, patch: Partial<MistakeSummary> = {}): MistakeSummary {
  return {
    id,
    said: 'that move',
    corrected: 'that moves',
    rule_key: 'subject_verb_agreement',
    lesson_state: 'ready',
    ladder_step: 1,
    is_fixed: false,
    is_due: true,
    last_seen_at: 1_800_000_000_000,
    ...patch,
  };
}

function group(patch: Partial<MistakeGroup> = {}): MistakeGroup {
  return {
    rule_key: 'subject_verb_agreement',
    title: 'Subject-verb agreement',
    summary: 'The verb agrees with its subject.',
    mistake_count: 1,
    fixed_count: 0,
    due_count: 1,
    relapse_count: 0,
    last_relapse_at: null,
    mistakes: [summary(1)],
    ...patch,
  };
}

const groups: MistakeGroups = {
  groups: [group({ mistake_count: 5, fixed_count: 2 }), group({ mistake_count: 1 })],
  ungrouped: [summary(9, { is_fixed: true })],
  due_count: 6,
};

it('summarises the library in one line', () => {
  expect(overviewLine(groups)).toBe('7 mistakes in 2 rules · 6 ready to practise · 3 fixed');
});

it('uses the singular for a single mistake and rule', () => {
  expect(overviewLine({ groups: [group()], ungrouped: [], due_count: 0 })).toBe(
    '1 mistake in 1 rule · 0 ready to practise · 0 fixed',
  );
});

it('counts fixed mistakes in groups and among the unsorted', () => {
  expect(fixedMistakes(groups)).toBe(3);
});

it('says when a rule came back, only after a relapse', () => {
  expect(relapseLabel(group())).toBeNull();
  const label = relapseLabel(group({ relapse_count: 1, last_relapse_at: 1_800_000_000_000 }));
  expect(label).toMatch(/^Came back on [A-Z][a-z]{2} \d{1,2}$/);
});

it('labels fixed mistakes only when there are some', () => {
  expect(fixedLabel(group())).toBeNull();
  expect(fixedLabel(group({ fixed_count: 4 }))).toBe('4 fixed');
});

it('counts the mistakes the group does not show', () => {
  expect(
    moreLabel(group({ mistake_count: 14, mistakes: [1, 2, 3, 4].map((id) => summary(id)) })),
  ).toBe('and 11 more');
  expect(moreLabel(group({ mistake_count: 2, mistakes: [summary(1), summary(2)] }))).toBeNull();
});

it('names the practice by its due count', () => {
  expect(practiseLabel(6)).toBe('Practise 6 · 5 min');
});
