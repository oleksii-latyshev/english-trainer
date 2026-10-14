import { describe, expect, it } from 'bun:test';
import type { RecallResult, ReviewItem } from '@/core/learning-memory';
import { mergeRecallResult } from '@/core/learning-memory';
import { returnsIn, statusMove, summarizeReview } from './index';

function pending(position: number, itemType: 'phrase' | 'mistake', itemId: number): ReviewItem {
  return {
    position,
    item_type: itemType,
    item_id: itemId,
    cue: `Cue ${position}`,
    target: null,
    transcript: null,
    wording_observed: null,
    saved_response: null,
    next_review_at: null,
    interval_days: null,
    status: null,
    is_skipped: false,
  };
}

function resultFor(item: ReviewItem, wordingObserved = true): RecallResult {
  return {
    run_id: 100,
    position: item.position,
    item_type: item.item_type,
    item_id: item.item_id,
    cue: item.cue,
    target: `Target ${item.position}`,
    transcript: `Learner said target ${item.position}`,
    wording_observed: wordingObserved,
    saved_response: wordingObserved ? 'remembered' : 'need_practice',
    next_review_at: 2000,
    interval_days: wordingObserved ? 2 : 1,
    status: 'learning',
  };
}

function answered(items: readonly ReviewItem[], index: number, wordingObserved = true) {
  const run = { run_id: 100, items, completed: false };
  const merged = mergeRecallResult(run, resultFor(items[index], wordingObserved));
  return merged?.items[index] as ReviewItem;
}

function skipped(item: ReviewItem): ReviewItem {
  return { ...item, is_skipped: true };
}

describe('review wording', () => {
  it('says when an item returns', () => {
    expect(returnsIn(1)).toBe('tomorrow');
    expect(returnsIn(4)).toBe('in 4 days');
  });

  it('says what the answer did to the status', () => {
    expect(statusMove('new', 'learning')).toEqual({ prefix: 'Moves to', status: 'Learning' });
    expect(statusMove('improving', 'improving')).toEqual({ prefix: 'Stays', status: 'Improving' });
    expect(statusMove(null, 'learning')).toEqual({ prefix: 'Now', status: 'Learning' });
  });
});

describe('review summary', () => {
  const phrases = [pending(1, 'phrase', 1), pending(2, 'phrase', 2), pending(3, 'phrase', 3)];

  it('summarizes used, not-yet and skipped items from the saved results', () => {
    const summary = summarizeReview([
      answered(phrases, 0),
      answered(phrases, 1, false),
      skipped(phrases[2]),
    ]);
    expect(summary.headline).toBe(
      'You used 1 of 3 phrases during this review. The rest come back tomorrow. The skipped one stays due.',
    );
    expect(summary).toMatchObject({ usedCount: 1, totalCount: 3 });
    expect(summary.entries).toEqual([
      { key: 'phrase-1', label: 'Target 1', outcome: 'used', status: 'learning' },
      { key: 'phrase-2', label: 'Target 2', outcome: 'not-yet', status: 'learning' },
      { key: 'phrase-3', label: 'Cue 3', outcome: 'skipped', status: null },
    ]);
  });

  it('keeps the headline short when everything was used and calls mixed queues items', () => {
    const mixed = [pending(1, 'phrase', 1), pending(2, 'mistake', 2)];
    const summary = summarizeReview([answered(mixed, 0), answered(mixed, 1)]);
    expect(summary.headline).toBe('You used 2 of 2 items during this review.');
  });
});
