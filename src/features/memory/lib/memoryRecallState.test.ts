// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type {
  MemoryRecallResult,
  MemoryReviewItem,
  MemoryReviewRun,
} from '@/lib/memoryRecallTypes';
import {
  getCurrentPendingItem,
  getResolvedItemCount,
  isRunFinished,
  mergeRecallResult,
  returnsIn,
  statusMove,
  summarizeReview,
} from './memoryRecallState';

const pending = (
  position: number,
  item_type: 'phrase' | 'mistake',
  item_id: number,
): MemoryReviewItem => ({
  position,
  item_type,
  item_id,
  cue: `Cue ${position}`,
  target: null,
  transcript: null,
  wording_observed: null,
  saved_response: null,
  next_review_at: null,
  interval_days: null,
  status: null,
  is_skipped: false,
});

const result = (
  position: number,
  item_type: 'phrase' | 'mistake',
  item_id: number,
  wording_observed = true,
): MemoryRecallResult => ({
  run_id: 100,
  position,
  item_type,
  item_id,
  cue: `Cue ${position}`,
  target: `Target ${position}`,
  transcript: `Learner said target ${position}`,
  wording_observed,
  saved_response: wording_observed ? 'remembered' : 'need_practice',
  next_review_at: 2000,
  interval_days: wording_observed ? 2 : 1,
  status: 'learning',
});

const run: MemoryReviewRun = {
  run_id: 100,
  items: [pending(1, 'phrase', 1), pending(2, 'mistake', 2), pending(3, 'phrase', 3)],
  completed: false,
};

const skipped = (item: MemoryReviewItem): MemoryReviewItem => ({
  position: item.position,
  item_type: item.item_type,
  item_id: item.item_id,
  cue: item.cue,
  target: null,
  transcript: null,
  wording_observed: null,
  saved_response: null,
  next_review_at: null,
  interval_days: null,
  status: null,
  is_skipped: true,
});

describe('review queue state', () => {
  it('finds the first item that is neither answered nor skipped', () => {
    expect(getCurrentPendingItem(run.items)?.position).toBe(1);
    const merged = mergeRecallResult(run, result(1, 'phrase', 1));
    expect(getCurrentPendingItem(merged.items)?.position).toBe(2);
    expect(getResolvedItemCount(merged.items)).toBe(1);
    const withSkip = [merged.items[0], skipped(merged.items[1]), merged.items[2]];
    expect(getCurrentPendingItem(withSkip)?.position).toBe(3);
    expect(getResolvedItemCount(withSkip)).toBe(2);
    expect(isRunFinished(withSkip)).toBe(false);
  });

  it('is finished only when every item is answered or skipped', () => {
    expect(isRunFinished([])).toBe(false);
    const items = [
      mergeRecallResult(run, result(1, 'phrase', 1)).items[0],
      skipped(run.items[1]),
      mergeRecallResult(run, result(3, 'phrase', 3, false)).items[2],
    ];
    expect(isRunFinished(items)).toBe(true);
    expect(getCurrentPendingItem(items)).toBeNull();
  });

  it('merges a saved result into its own item only', () => {
    const merged = mergeRecallResult(run, result(1, 'phrase', 1));
    expect(merged.items[0]).toMatchObject({
      target: 'Target 1',
      saved_response: 'remembered',
      status: 'learning',
      is_skipped: false,
    });
    expect(merged.items[1]).toEqual(run.items[1]);
    expect(run.items[0].saved_response).toBeNull();
  });

  it('refuses a result that belongs to another run, item or cue', () => {
    expect(() => mergeRecallResult(run, { ...result(1, 'phrase', 1), run_id: 7 })).toThrow();
    expect(() => mergeRecallResult(run, result(1, 'phrase', 9))).toThrow();
    expect(() => mergeRecallResult(run, result(2, 'phrase', 1))).toThrow();
    expect(() => mergeRecallResult(run, { ...result(1, 'phrase', 1), cue: 'Other' })).toThrow();
  });

  it('accepts the same saved result again but not a different transcript', () => {
    const once = mergeRecallResult(run, result(1, 'phrase', 1));
    expect(mergeRecallResult(once, result(1, 'phrase', 1)).items[0]).toEqual(once.items[0]);
    expect(() =>
      mergeRecallResult(once, { ...result(1, 'phrase', 1), transcript: 'Different' }),
    ).toThrow();
  });
});

describe('review wording', () => {
  it('says when an item returns', () => {
    expect(returnsIn(1)).toBe('tomorrow');
    expect(returnsIn(4)).toBe('in 4 days');
  });

  it('says what the answer did to the status', () => {
    expect(statusMove('new', 'learning')).toBe('Moves to learning');
    expect(statusMove('improving', 'improving')).toBe('Stays improving');
    expect(statusMove(null, 'learning')).toBe('Now learning');
  });

  it('summarizes used, not-yet and skipped items from the saved results', () => {
    const phrases: MemoryReviewRun = {
      ...run,
      items: [pending(1, 'phrase', 1), pending(2, 'phrase', 2), pending(3, 'phrase', 3)],
    };
    const items: MemoryReviewItem[] = [
      mergeRecallResult(phrases, result(1, 'phrase', 1)).items[0],
      mergeRecallResult(phrases, result(2, 'phrase', 2, false)).items[1],
      skipped(phrases.items[2]),
    ];
    const summary = summarizeReview(items);
    expect(summary.headline).toBe(
      'You used 1 of 3 phrases during this review. The rest come back tomorrow. The skipped one stays due.',
    );
    expect(summary.entries).toEqual([
      { key: 'phrase-1', label: 'Target 1', outcome: 'used', status: 'learning' },
      { key: 'phrase-2', label: 'Target 2', outcome: 'not-yet', status: 'learning' },
      { key: 'phrase-3', label: 'Cue 3', outcome: 'skipped', status: null },
    ]);
  });

  it('keeps the headline short when everything was used and calls mixed queues items', () => {
    const items = [
      mergeRecallResult(run, result(1, 'phrase', 1)).items[0],
      mergeRecallResult(run, result(2, 'mistake', 2)).items[1],
    ];
    expect(summarizeReview(items).headline).toBe('You used 2 of 2 items during this review.');
  });
});
