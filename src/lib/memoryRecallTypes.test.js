import { describe, expect, it } from 'bun:test';
import { isMemoryRecallResult, isMemoryReviewItem, isMemoryReviewRun } from './memoryRecallTypes';

const pending = {
  position: 1,
  item_type: 'phrase',
  item_id: 42,
  cue: 'A compromise note',
  target: null,
  transcript: null,
  wording_observed: null,
  saved_response: null,
  next_review_at: null,
  interval_days: null,
  status: null,
};

const saved = {
  ...pending,
  target: 'trade-off',
  transcript: 'The trade off was essential.',
  wording_observed: true,
  saved_response: 'remembered',
  next_review_at: 1727784000000,
  interval_days: 2,
  status: 'learning',
};

const result = {
  run_id: 10,
  position: 1,
  item_type: 'phrase',
  item_id: 42,
  cue: 'A compromise note',
  target: 'trade-off',
  transcript: 'The trade off was essential.',
  wording_observed: true,
  saved_response: 'remembered',
  next_review_at: 1727784000000,
  interval_days: 2,
  status: 'learning',
};

describe('memory recall IPC guards', () => {
  it('accepts Rust Option fields serialized as null on a pending item', () => {
    expect(isMemoryReviewItem(pending)).toBe(true);
    expect(isMemoryReviewRun({ run_id: 10, items: [pending], completed: false })).toBe(true);
    expect(isMemoryReviewRun({ run_id: 10, items: [pending], completed: true })).toBe(false);
  });

  it('accepts a saved item only when target, transcript, and schedule evidence are complete', () => {
    expect(isMemoryReviewItem(saved)).toBe(true);
    expect(isMemoryReviewItem({ ...saved, target: null })).toBe(false);
    expect(isMemoryReviewItem({ ...saved, interval_days: null })).toBe(false);
    expect(isMemoryReviewItem({ ...saved, saved_response: 'need_practice' })).toBe(false);
  });

  it('rejects malformed IDs, missing null fields, unsafe positions, and inconsistent queues', () => {
    expect(isMemoryReviewItem({ ...pending, item_id: 0 })).toBe(false);
    expect(isMemoryReviewItem({ ...pending, item_id: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
    expect(isMemoryReviewItem({ ...pending, position: 4 })).toBe(false);
    const missingField = { ...pending };
    delete missingField.target;
    expect(isMemoryReviewItem(missingField)).toBe(false);
    expect(
      isMemoryReviewRun({ run_id: 10, items: [{ ...pending, position: 2 }], completed: false }),
    ).toBe(false);
    expect(
      isMemoryReviewRun({
        run_id: 10,
        items: [pending, { ...pending, position: 2 }],
        completed: false,
      }),
    ).toBe(false);
    expect(
      isMemoryReviewRun({
        run_id: 10,
        items: [pending, { ...saved, position: 2 }],
        completed: false,
      }),
    ).toBe(false);
  });

  it('requires a complete saved result and rejects malformed evidence', () => {
    expect(isMemoryRecallResult(result)).toBe(true);
    expect(isMemoryRecallResult({ ...result, run_id: 0 })).toBe(false);
    expect(isMemoryRecallResult({ ...result, transcript: '' })).toBe(false);
    expect(isMemoryRecallResult({ ...result, wording_observed: 'yes' })).toBe(false);
    expect(isMemoryRecallResult({ ...result, interval_days: 0 })).toBe(false);
    expect(isMemoryRecallResult({ ...result, saved_response: 'need_practice' })).toBe(false);
  });
});
