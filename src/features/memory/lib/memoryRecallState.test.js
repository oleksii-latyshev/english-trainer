import { describe, expect, it } from 'bun:test';
import {
  getCompletedItemCount,
  getCurrentPendingItem,
  isRunFinished,
  mergeRecallResult,
} from './memoryRecallState';

const pending = (position, item_type, item_id) => ({
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
});

const run = {
  run_id: 100,
  items: [pending(1, 'phrase', 1), pending(2, 'mistake', 2)],
  completed: false,
};

const result = (position, item_type, item_id) => ({
  run_id: 100,
  position,
  item_type,
  item_id,
  cue: `Cue ${position}`,
  target: `Target ${position}`,
  transcript: `Learner said target ${position}`,
  wording_observed: true,
  saved_response: 'remembered',
  next_review_at: 2000,
  interval_days: 2,
  status: 'learning',
});

describe('memory recall progress', () => {
  it('finds the first pending item and counts explicit null as pending', () => {
    expect(getCurrentPendingItem(run.items)).toEqual(run.items[0]);
    expect(getCompletedItemCount(run.items)).toBe(0);
    expect(isRunFinished(run.items)).toBe(false);
  });

  it('merges only matching run, position, and item identity', () => {
    const updated = mergeRecallResult(run, result(1, 'phrase', 1));
    expect(getCompletedItemCount(updated.items)).toBe(1);
    expect(updated.items[0].target).toBe('Target 1');
    expect(getCurrentPendingItem(updated.items)).toEqual(run.items[1]);
    expect(() => mergeRecallResult(run, { ...result(1, 'phrase', 1), run_id: 99 })).toThrow();
    expect(() => mergeRecallResult(run, { ...result(1, 'phrase', 1), item_id: 7 })).toThrow();
    expect(() => mergeRecallResult(run, { ...result(1, 'phrase', 1), position: 2 })).toThrow();
    expect(() => mergeRecallResult(run, { ...result(1, 'phrase', 1), cue: 'wrong cue' })).toThrow();
  });

  it('recognizes a completed queue after its final saved result', () => {
    const afterFirst = mergeRecallResult(run, result(1, 'phrase', 1));
    const afterSecond = mergeRecallResult(afterFirst, result(2, 'mistake', 2));
    expect(getCompletedItemCount(afterSecond.items)).toBe(2);
    expect(getCurrentPendingItem(afterSecond.items)).toBeNull();
    expect(isRunFinished(afterSecond.items)).toBe(true);
  });
});
