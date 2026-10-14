import { describe, expect, it } from 'bun:test';
import type { RecallResult, ReviewItem, ReviewRun } from '../../types';
import { currentPendingItem, isRunFinished, mergeRecallResult, resolvedItemCount } from './index';

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

function result(
  position: number,
  itemType: 'phrase' | 'mistake',
  itemId: number,
  wordingObserved = true,
): RecallResult {
  return {
    run_id: 100,
    position,
    item_type: itemType,
    item_id: itemId,
    cue: `Cue ${position}`,
    target: `Target ${position}`,
    transcript: `Learner said target ${position}`,
    wording_observed: wordingObserved,
    saved_response: wordingObserved ? 'remembered' : 'need_practice',
    next_review_at: 2000,
    interval_days: wordingObserved ? 2 : 1,
    status: 'learning',
  };
}

const run: ReviewRun = {
  run_id: 100,
  items: [pending(1, 'phrase', 1), pending(2, 'mistake', 2), pending(3, 'phrase', 3)],
  completed: false,
};

function skipped(item: ReviewItem): ReviewItem {
  return { ...item, is_skipped: true };
}

function merged(source: ReviewRun, answer: RecallResult): ReviewRun {
  const next = mergeRecallResult(source, answer);
  if (next === null) throw new Error('the result should match the queue');
  return next;
}

describe('review queue', () => {
  it('finds the first item that is neither answered nor skipped', () => {
    expect(currentPendingItem(run.items)?.position).toBe(1);
    const after = merged(run, result(1, 'phrase', 1));
    expect(currentPendingItem(after.items)?.position).toBe(2);
    expect(resolvedItemCount(after.items)).toBe(1);
    const withSkip = [after.items[0], skipped(after.items[1]), after.items[2]];
    expect(currentPendingItem(withSkip)?.position).toBe(3);
    expect(resolvedItemCount(withSkip)).toBe(2);
    expect(isRunFinished(withSkip)).toBe(false);
  });

  it('is finished only when every item is answered or skipped', () => {
    expect(isRunFinished([])).toBe(false);
    const items = [
      merged(run, result(1, 'phrase', 1)).items[0],
      skipped(run.items[1]),
      merged(run, result(3, 'phrase', 3, false)).items[2],
    ];
    expect(isRunFinished(items)).toBe(true);
    expect(currentPendingItem(items)).toBeNull();
  });

  it('merges a saved result into its own item only', () => {
    const after = merged(run, result(1, 'phrase', 1));
    expect(after.items[0]).toMatchObject({
      target: 'Target 1',
      saved_response: 'remembered',
      status: 'learning',
      is_skipped: false,
    });
    expect(after.items[1]).toEqual(run.items[1]);
    expect(run.items[0].saved_response).toBeNull();
  });

  it('refuses a result that belongs to another run, item or cue', () => {
    expect(mergeRecallResult(run, { ...result(1, 'phrase', 1), run_id: 7 })).toBeNull();
    expect(mergeRecallResult(run, result(1, 'phrase', 9))).toBeNull();
    expect(mergeRecallResult(run, result(2, 'phrase', 1))).toBeNull();
    expect(mergeRecallResult(run, { ...result(1, 'phrase', 1), cue: 'Other' })).toBeNull();
  });

  it('accepts the same saved result again but not a different transcript', () => {
    const once = merged(run, result(1, 'phrase', 1));
    expect(merged(once, result(1, 'phrase', 1)).items[0]).toEqual(once.items[0]);
    expect(
      mergeRecallResult(once, { ...result(1, 'phrase', 1), transcript: 'Different' }),
    ).toBeNull();
  });
});
