// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { MistakeRecord, PhraseCardRecord } from '@/lib/learningTypes';
import {
  formatDueText,
  formatStatusLabel,
  mistakeSourceLine,
  phraseSourceLine,
  searchMemory,
  visibleMemory,
  whenLabel,
} from './memoryState';

const NOW = new Date(2026, 9, 7, 15, 30).getTime();
const day = (offset: number) => new Date(2026, 9, 7 - offset, 9, 0).getTime();

const mistake: MistakeRecord = {
  id: 1,
  normalized_key: 'grammar:every bank sends',
  category: 'grammar',
  original_example: 'every bank send',
  corrected_example: 'every bank sends',
  explanation: 'Third person singular needs -s.',
  times_seen: 3,
  times_correct_afterwards: 0,
  last_seen_at: day(0),
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
  normalized_phrase: 'bring them into one format',
  meaning_or_note: 'we had to make all data same',
  session_id: 4,
  sequence: 2,
  created_at: day(3),
  last_reviewed_at: null,
  next_review_at: 2000,
  interval_days: 1,
  ease_factor: 2.5,
  status: 'new',
  is_due: false,
};

describe('memory text', () => {
  it('formats due text from timestamps', () => {
    expect(formatDueText(500, 1000)).toBe('Due for review');
    expect(formatDueText(1000 + 3600 * 1000 * 2, 1000)).toBe('Due in 2h');
    expect(formatDueText(1000 + 3600 * 1000 * 48, 1000)).toBe('Due in 2d');
  });

  it('labels every status', () => {
    expect(formatStatusLabel('new')).toBe('New');
    expect(formatStatusLabel('stable')).toBe('Stable');
    expect(formatStatusLabel('archived')).toBe('Archived');
  });

  it('says when in calendar days, not in 24-hour blocks', () => {
    expect(whenLabel(day(0), NOW)).toBe('today');
    expect(whenLabel(new Date(2026, 9, 6, 23, 59).getTime(), NOW)).toBe('yesterday');
    expect(whenLabel(day(3), NOW)).toBe('3 days ago');
    expect(whenLabel(day(8), NOW)).toBe('last week');
    expect(whenLabel(day(22), NOW)).toBe('3 weeks ago');
    expect(whenLabel(day(75), NOW)).toBe('2 months ago');
    expect(whenLabel(NOW + 3600_000, NOW)).toBe('today');
  });

  it('builds the source line of a phrase from its note and age', () => {
    expect(phraseSourceLine(phrase, NOW)).toBe('we had to make all data same · 3 days ago');
    expect(phraseSourceLine({ ...phrase, meaning_or_note: ' ' }, NOW)).toBe(
      'From a conversation · 3 days ago',
    );
    expect(
      phraseSourceLine({ ...phrase, meaning_or_note: '', session_id: null, sequence: null }, NOW),
    ).toBe('Saved by hand · 3 days ago');
    expect(phraseSourceLine({ ...phrase, session_topic: 'Plans & stories' }, NOW)).toBe(
      'Plans & stories · we had to make all data same · 3 days ago',
    );
  });

  it('builds the source line of a mistake from how often it came up', () => {
    expect(mistakeSourceLine(mistake, NOW)).toBe('3 times · last: today');
    expect(mistakeSourceLine({ ...mistake, times_seen: 1, last_seen_at: day(2) }, NOW)).toBe(
      '1 time · last: 2 days ago',
    );
  });
});

describe('what Memory shows', () => {
  const view = {
    phrase_cards: [
      phrase,
      { ...phrase, id: 2, phrase: 'Archived one', status: 'archived' as const },
    ],
    mistakes: [mistake, { ...mistake, id: 2, status: 'archived' as const }],
    due_count: 1,
  };

  it('hides archived phrases and mistakes', () => {
    const memory = visibleMemory(view);
    expect(memory.phrases.map((card) => card.id)).toEqual([1]);
    expect(memory.mistakes.map((item) => item.id)).toEqual([1]);
  });

  it('searches wording and source in both lists, ignoring case', () => {
    const memory = visibleMemory(view);
    expect(searchMemory(memory, '  ').phrases).toHaveLength(1);
    expect(searchMemory(memory, 'ALL DATA').phrases).toHaveLength(1);
    expect(searchMemory(memory, 'all data').mistakes).toHaveLength(0);
    expect(searchMemory(memory, 'bank sends').mistakes).toHaveLength(1);
    expect(searchMemory(memory, 'third person').mistakes).toHaveLength(1);
    expect(searchMemory(memory, 'nothing like this')).toEqual({ phrases: [], mistakes: [] });
  });
});
