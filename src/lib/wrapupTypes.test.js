import { describe, expect, it } from 'bun:test';
import { isSavedWrapupPhrases, isWrapupEvent, isWrapupPreparation } from './wrapupTypes';

describe('wrap-up IPC types', () => {
  it('accepts each preparation state and typed provider failures', () => {
    expect(isWrapupPreparation({ state: 'legacy' })).toBe(true);
    expect(isWrapupPreparation({ state: 'pending' })).toBe(true);
    expect(isWrapupPreparation({ state: 'ready' })).toBe(true);
    expect(
      isWrapupPreparation({ state: 'failed', error: { code: 'timeout', message: 'Retry.' } }),
    ).toBe(true);
    expect(
      isWrapupPreparation({ state: 'failed', error: { code: 'unknown', message: 'Retry.' } }),
    ).toBe(false);
    expect(isWrapupPreparation({ state: 'paused' })).toBe(false);
  });

  it('narrows session events and atomic-save results', () => {
    const card = {
      id: 3,
      phrase: 'I tend to plan ahead.',
      normalized_phrase: 'i tend to plan ahead.',
      meaning_or_note: 'A common habit.',
      session_id: 9,
      sequence: 1,
      created_at: 1,
      last_reviewed_at: null,
      next_review_at: 2,
      interval_days: 1,
      ease_factor: 2.5,
      status: 'new',
      is_due: true,
    };
    expect(isWrapupEvent({ session_id: 9 })).toBe(true);
    expect(isWrapupEvent({ session_id: 0 })).toBe(false);
    expect(isSavedWrapupPhrases({ cards: [card], created_ids: [3] })).toBe(true);
    expect(isSavedWrapupPhrases({ cards: [card], created_ids: [4] })).toBe(false);
    expect(isSavedWrapupPhrases({ cards: [card, card], created_ids: [3] })).toBe(false);
    expect(isSavedWrapupPhrases({ cards: [], created_ids: [] })).toBe(false);
    expect(isSavedWrapupPhrases({ cards: [{}], created_ids: [] })).toBe(false);
    expect(isSavedWrapupPhrases({ cards: [], created_ids: ['3'] })).toBe(false);
  });
});
