import { describe, expect, it } from 'bun:test';
import type { TurnFeedback } from '../../types';
import { findingGroups, reasonLine } from '.';

const empty: TurnFeedback = {
  focus_feedback: [],
  b2_rewrite: 'Fine.',
  upgrades: [],
  gaps: [],
  words_to_take: [],
};

const full: TurnFeedback = {
  ...empty,
  focus_feedback: [
    { category: 'grammar', original: 'I go', improved: 'I went', explanation: 'Use the past.' },
  ],
  upgrades: [{ original: 'very tired', improved: 'exhausted', explanation: 'Stronger word.' }],
  gaps: [{ original: 'the thing', word: 'agenda', meaning: 'a list of topics' }],
};

describe('findingGroups', () => {
  it('groups fixes, better versions and missing words in that order', () => {
    expect(findingGroups(full).map((group) => [group.kind, group.label])).toEqual([
      ['fix', 'Fix'],
      ['better', 'Better'],
      ['gap', 'Missing word'],
    ]);
  });

  it('shows the missing word as what was needed, with its meaning as the note', () => {
    expect(findingGroups(full)[2]?.findings).toEqual([
      { said: 'the thing', better: 'agenda', note: 'a list of topics' },
    ]);
  });

  it('leaves out groups with nothing in them', () => {
    expect(findingGroups(empty)).toEqual([]);
  });
});

describe('reasonLine', () => {
  it('gives the reason of the first finding, fixes before better versions', () => {
    expect(reasonLine(full)).toBe('Use the past.');
    expect(reasonLine({ ...full, focus_feedback: [] })).toBe('Stronger word.');
  });

  it('says so when the answer needs nothing', () => {
    expect(reasonLine(empty)).toBe('This answer already sounds natural.');
  });
});
