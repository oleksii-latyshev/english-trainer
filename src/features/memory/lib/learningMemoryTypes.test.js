import { describe, expect, it } from 'bun:test';
import { isMistakeRecord, isPhraseCardRecord } from '@/lib/learningTypes';

const phraseCard = {
  id: 1,
  phrase: 'The main trade-off was',
  normalized_phrase: 'the main trade off was',
  meaning_or_note: '',
  session_id: 12,
  sequence: 2,
  created_at: 1_000,
  last_reviewed_at: null,
  next_review_at: 2_000,
  interval_days: 1,
  ease_factor: 2.5,
  status: 'learning',
  is_due: false,
};

describe('learning memory IPC records', () => {
  it('accepts a bounded mistake explanation up to 500 characters', () => {
    const mistake = {
      id: 2,
      normalized_key: 'at university',
      category: 'grammar',
      original_example: 'in the university',
      corrected_example: 'at university',
      explanation: 'x'.repeat(500),
      times_seen: 2,
      times_correct_afterwards: 0,
      last_seen_at: 1,
      last_reviewed_at: null,
      next_review_at: 2,
      interval_days: 1,
      ease_factor: 2.5,
      status: 'learning',
      is_due: false,
    };
    expect(isMistakeRecord(mistake)).toBe(true);
    expect(isMistakeRecord({ ...mistake, explanation: 'x'.repeat(501) })).toBe(false);
  });

  it('accepts bounded phrase records with complete provenance', () => {
    expect(isPhraseCardRecord(phraseCard)).toBe(true);
    expect(isPhraseCardRecord({ ...phraseCard, session_id: null, sequence: null })).toBe(true);
    expect(isPhraseCardRecord({ ...phraseCard, session_topic: 'Plans & stories' })).toBe(true);
    expect(isPhraseCardRecord({ ...phraseCard, session_topic: null })).toBe(true);
  });

  it('rejects empty phrase text and incomplete or invalid provenance', () => {
    expect(isPhraseCardRecord({ ...phraseCard, phrase: '' })).toBe(false);
    expect(isPhraseCardRecord({ ...phraseCard, session_id: null })).toBe(false);
    expect(isPhraseCardRecord({ ...phraseCard, sequence: -1 })).toBe(false);
    expect(isPhraseCardRecord({ ...phraseCard, session_topic: 4 })).toBe(false);
  });

  it('rejects unbounded schedule fields', () => {
    expect(isPhraseCardRecord({ ...phraseCard, interval_days: 0 })).toBe(false);
    expect(isPhraseCardRecord({ ...phraseCard, ease_factor: Number.NaN })).toBe(false);
    expect(isPhraseCardRecord({ ...phraseCard, phrase: 'x'.repeat(301) })).toBe(false);
  });
});
