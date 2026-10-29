import { expect, it } from 'bun:test';
import type { MistakeGroup, MistakeGroups } from '@/core/mistakes';
import { usualRules } from './index';

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

it('lists the three rules that come back most often', () => {
  const groups: MistakeGroups = {
    groups: [group('A', 2), group('B', 9), group('C', 5), group('D', 7)],
    ungrouped: [],
    due_count: 0,
  };
  expect(usualRules(groups).map((rule) => rule.title)).toEqual(['B', 'D', 'C']);
});

it('skips rules that hold a single mistake', () => {
  expect(usualRules({ groups: [group('A', 1)], ungrouped: [], due_count: 0 })).toEqual([]);
});
