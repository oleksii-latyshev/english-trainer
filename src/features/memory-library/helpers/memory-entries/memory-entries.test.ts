import { describe, expect, it } from 'bun:test';
import type { MistakeRecord, PhraseCardRecord } from '@/core/ipc';
import type { LearningMemory } from '@/core/learning-memory';
import {
  entriesOfTab,
  entryKey,
  entryLabel,
  searchEntries,
  statusCounts,
  toEntries,
  usedOnOwnCount,
  visibleEntries,
} from './index';

const mistake: MistakeRecord = {
  id: 1,
  normalized_key: 'grammar:every bank sends',
  category: 'grammar',
  original_example: 'every bank send',
  corrected_example: 'every bank sends',
  explanation: 'Third person singular needs -s.',
  times_seen: 3,
  times_correct_afterwards: 2,
  last_seen_at: 1,
  last_reviewed_at: null,
  next_review_at: 500,
  interval_days: 1,
  ease_factor: 2.5,
  status: 'learning',
  is_due: true,
};

const phrase: PhraseCardRecord = {
  id: 1,
  phrase: 'bring them into one format',
  kind: 'phrase',
  normalized_phrase: 'bring them into one format',
  meaning_or_note: 'we had to make all data same',
  session_id: 4,
  sequence: 2,
  created_at: 1,
  last_reviewed_at: null,
  next_review_at: 2000,
  interval_days: 1,
  ease_factor: 2.5,
  status: 'new',
  is_due: false,
  times_used_on_own: 3,
};

const view: LearningMemory = {
  phrase_cards: [phrase, { ...phrase, id: 2, phrase: 'Archived one', status: 'archived' }],
  mistakes: [
    mistake,
    { ...mistake, id: 2, status: 'archived' },
    { ...mistake, id: 3, status: 'stable' },
  ],
  due_count: 1,
};

describe('what Memory shows', () => {
  const entries = toEntries(view);

  it('hides archived phrases and mistakes unless asked', () => {
    expect(visibleEntries(entries, false)).toHaveLength(3);
    expect(visibleEntries(entries, true)).toHaveLength(5);
  });

  it('splits phrases from mistakes by tab', () => {
    expect(entriesOfTab(entries, 'phrases')).toHaveLength(2);
    expect(entriesOfTab(entries, 'mistakes')).toHaveLength(3);
  });

  it('searches wording and source in both lists, ignoring case', () => {
    const visible = visibleEntries(entries, false);
    expect(searchEntries(visible, '  ')).toHaveLength(3);
    expect(searchEntries(visible, 'ALL DATA').map(entryKey)).toEqual(['phrase-1']);
    expect(searchEntries(visible, 'bank sends').map(entryKey)).toEqual(['mistake-1', 'mistake-3']);
    expect(searchEntries(visible, 'third person')).toHaveLength(2);
    expect(searchEntries(visible, 'nothing like this')).toEqual([]);
  });

  it('counts the active statuses for the summary and leaves archived out', () => {
    expect(statusCounts(entries)).toEqual({ new: 1, learning: 1, improving: 0, stable: 1 });
  });

  it('labels and keys an entry by its kind', () => {
    const [firstPhrase] = entriesOfTab(entries, 'phrases');
    const [firstMistake] = entriesOfTab(entries, 'mistakes');
    expect(firstPhrase && entryLabel(firstPhrase)).toBe('bring them into one format');
    expect(firstMistake && entryLabel(firstMistake)).toBe('every bank send → every bank sends');
    expect(firstPhrase && entryKey(firstPhrase)).toBe('phrase-1');
    expect(firstMistake && entryKey(firstMistake)).toBe('mistake-1');
  });

  it('counts how often the learner used it on their own', () => {
    const [firstPhrase] = entriesOfTab(entries, 'phrases');
    const [firstMistake] = entriesOfTab(entries, 'mistakes');
    expect(firstPhrase && usedOnOwnCount(firstPhrase)).toBe(3);
    expect(firstMistake && usedOnOwnCount(firstMistake)).toBe(2);
  });
});
