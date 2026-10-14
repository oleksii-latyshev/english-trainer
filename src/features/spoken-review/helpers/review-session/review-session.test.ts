import { describe, expect, it } from 'bun:test';
import type { RecallResult, ReviewItem, ReviewRun } from '@/core/learning-memory';
import {
  begin,
  cancelPractice,
  fail,
  isAnswering,
  isTooLong,
  isTryingAgain,
  MAX_TRANSCRIPT_CHARS,
  nextItem,
  openSession,
  practiced,
  saved,
  shownItem,
  skipped,
  startPractice,
  summarized,
} from './index';

function pending(position: number, itemId: number): ReviewItem {
  return {
    position,
    item_type: 'phrase',
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

const run: ReviewRun = { run_id: 9, items: [pending(1, 11), pending(2, 12)], completed: false };

const result: RecallResult = {
  run_id: 9,
  position: 1,
  item_type: 'phrase',
  item_id: 11,
  cue: 'Cue 1',
  target: 'Target 1',
  transcript: 'Target 1 said',
  wording_observed: true,
  saved_response: 'remembered',
  next_review_at: 100,
  interval_days: 2,
  status: 'learning',
};

function savedSession() {
  const session = saved(openSession(run), result);
  if (session === null) throw new Error('the result should match the queue');
  return session;
}

describe('review session', () => {
  it('starts answering the first item, or closing a run whose items are all resolved', () => {
    expect(openSession(run).step).toEqual({ tag: 'answering' });
    const done = { ...run, items: run.items.map((item) => ({ ...item, is_skipped: true })) };
    expect(openSession(done).step).toEqual({ tag: 'closing' });
  });

  it('shows the answered item on the result and the next pending item otherwise', () => {
    expect(shownItem(openSession(run))?.position).toBe(1);
    expect(shownItem(savedSession())?.position).toBe(1);
    expect(shownItem(nextItem(savedSession()))?.position).toBe(2);
  });

  it('keeps the words and reports the failure when a step fails', () => {
    const failing = fail(begin(openSession(run), 'saving'), 'save');
    expect(failing).toMatchObject({ pending: 'none', actionError: 'save' });
    expect(begin(failing, 'saving')).toMatchObject({ pending: 'saving', actionError: null });
  });

  it('refuses a result that does not belong to the queue', () => {
    expect(saved(openSession(run), { ...result, run_id: 1 })).toBeNull();
  });

  it('practises after the saved answer without changing the saved result', () => {
    const trying = startPractice(savedSession());
    expect(isTryingAgain(trying)).toBe(true);
    expect(isAnswering(trying)).toBe(true);
    const tried = practiced(trying, 'Another try');
    expect(tried.step).toMatchObject({ attempt: { tag: 'tried', transcript: 'Another try' } });
    expect(isAnswering(tried)).toBe(false);
    expect(cancelPractice(trying).step).toMatchObject({ attempt: { tag: 'saved' } });
    expect(tried.run).toEqual(savedSession().run);
  });

  it('ignores a practice try that was cancelled before its transcript arrived', () => {
    const cancelled = cancelPractice(startPractice(savedSession()));
    expect(practiced(cancelled, 'Late words')).toEqual(cancelled);
  });

  it('takes the run back from a skip and reaches the summary', () => {
    const skippedRun = { ...run, items: [{ ...run.items[0], is_skipped: true }, run.items[1]] };
    const afterSkip = skipped(begin(openSession(run), 'skipping'), skippedRun);
    expect(afterSkip).toMatchObject({ pending: 'none', actionError: null });
    expect(shownItem(afterSkip)?.position).toBe(2);
    expect(summarized(afterSkip).step).toEqual({ tag: 'summary' });
  });

  it('counts an answer by characters, not bytes', () => {
    expect(isTooLong('é'.repeat(MAX_TRANSCRIPT_CHARS))).toBe(false);
    expect(isTooLong('é'.repeat(MAX_TRANSCRIPT_CHARS + 1))).toBe(true);
  });
});
