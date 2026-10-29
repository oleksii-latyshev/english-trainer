import { describe, expect, it } from 'bun:test';
import type { PhraseCardRecord } from '@/core/ipc';
import type { LearningMemory } from '@/core/learning-memory';
import {
  entryKey,
  entryLabel,
  searchEntries,
  statusCounts,
  toEntries,
  usedOnOwnCount,
  visibleEntries,
} from './index';

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
  mistakes: [],
  due_count: 1,
};

describe('what Memory shows', () => {
  const entries = toEntries(view);

  it('hides archived phrases unless asked', () => {
    expect(visibleEntries(entries, false)).toHaveLength(1);
    expect(visibleEntries(entries, true)).toHaveLength(2);
  });

  it('lists phrases only, whatever mistakes the view holds', () => {
    const withMistake = toEntries({ ...view, mistakes: [{ id: 1 } as never] });
    expect(withMistake).toHaveLength(2);
  });

  it('searches wording and source, ignoring case', () => {
    const visible = visibleEntries(entries, false);
    expect(searchEntries(visible, '  ')).toHaveLength(1);
    expect(searchEntries(visible, 'ALL DATA').map(entryKey)).toEqual(['phrase-1']);
    expect(searchEntries(visible, 'nothing like this')).toEqual([]);
  });

  it('counts the active statuses for the summary and leaves archived out', () => {
    expect(statusCounts(entries)).toEqual({ new: 1, learning: 0, improving: 0, stable: 0 });
  });

  it('labels and keys an entry', () => {
    const [first] = entries;
    expect(first && entryLabel(first)).toBe('bring them into one format');
    expect(first && entryKey(first)).toBe('phrase-1');
  });

  it('counts how often the learner used it on their own', () => {
    const [first] = entries;
    expect(first && usedOnOwnCount(first)).toBe(3);
  });
});
