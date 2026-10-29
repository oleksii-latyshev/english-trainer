import { expect, it } from 'bun:test';
import type { MistakeGroup, MistakeGroups } from '../../types';
import { repeatedRules } from './index';

function group(title: string, count: number): MistakeGroup {
  return {
    rule_key: 'articles',
    title,
    summary: '',
    mistake_count: count,
    fixed_count: 0,
    due_count: 0,
    relapse_count: 0,
    last_relapse_at: null,
    mistakes: [],
  };
}

it('keeps the rules that hold two or more mistakes', () => {
  const groups: MistakeGroups = {
    groups: [group('A', 1), group('B', 2), group('C', 5)],
    ungrouped: [],
    due_count: 0,
  };
  expect(repeatedRules(groups).map((rule) => rule.title)).toEqual(['B', 'C']);
});
