import { describe, expect, it } from 'bun:test';
import type { MistakeRecord, PhraseCardRecord } from '@/core/ipc';
import {
  gapLabel,
  isDueToday,
  mistakeSourceLine,
  nextReviewLabel,
  phraseSourceLine,
  statusLabel,
  whenLabel,
} from './index';

const NOW = new Date(2026, 9, 7, 15, 30).getTime();
function day(offset: number): number {
  return new Date(2026, 9, 7 - offset, 9, 0).getTime();
}
function inDays(offset: number): number {
  return new Date(2026, 9, 7 + offset, 8, 0).getTime();
}

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
  times_used_on_own: 0,
};

describe('library copy', () => {
  it('names the next review in calendar days', () => {
    expect(nextReviewLabel(day(2), 'learning', NOW)).toBe('Today');
    expect(nextReviewLabel(inDays(0), 'learning', NOW)).toBe('Today');
    expect(nextReviewLabel(inDays(1), 'learning', NOW)).toBe('Tomorrow');
    expect(nextReviewLabel(inDays(12), 'stable', NOW)).toBe('In 12 days');
    expect(nextReviewLabel(inDays(3), 'archived', NOW)).toBe('Archived');
  });

  it('marks only an unarchived item that is due today', () => {
    expect(isDueToday(day(1), 'new', NOW)).toBe(true);
    expect(isDueToday(inDays(1), 'new', NOW)).toBe(false);
    expect(isDueToday(day(1), 'archived', NOW)).toBe(false);
  });

  it('writes the gap between reviews', () => {
    expect(gapLabel(1)).toBe('1 day');
    expect(gapLabel(14)).toBe('14 days');
  });

  it('labels every status', () => {
    expect(statusLabel('new')).toBe('New');
    expect(statusLabel('stable')).toBe('Stable');
    expect(statusLabel('archived')).toBe('Archived');
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

  it('builds the source line of a mistake from its kind and how often it came up', () => {
    expect(mistakeSourceLine(mistake)).toBe('Grammar · seen 3×');
    expect(mistakeSourceLine({ ...mistake, category: 'vocabulary', times_seen: 2 })).toBe(
      'Vocabulary · seen 2×',
    );
  });
});
