// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { MemoryRecallResult } from '@/lib/memoryRecallTypes';
import { describeResult } from './reviewResult';

const used: MemoryRecallResult = {
  run_id: 1,
  position: 1,
  item_type: 'phrase',
  item_id: 5,
  cue: 'A friend asks about your move.',
  target: 'the tricky part was',
  transcript: 'It went fine, but the tricky part was the internet.',
  wording_observed: true,
  saved_response: 'remembered',
  next_review_at: 5_000,
  interval_days: 4,
  status: 'improving',
};

const missed: MemoryRecallResult = {
  ...used,
  transcript: 'It was okay, the internet was a big problem.',
  wording_observed: false,
  saved_response: 'need_practice',
  interval_days: 1,
  status: 'learning',
};

describe('describeResult for the saved answer', () => {
  it('says what the status does and when the item returns when the wording was used', () => {
    const view = describeResult(used, { tag: 'saved' }, 'learning');
    expect(view).toMatchObject({
      tone: 'used',
      title: 'Used it',
      hint: { lead: 'Moves to improving', text: ' — it’ll come back in 4 days.' },
      showsModel: false,
      canTryAgain: false,
    });
    expect(view.segments.filter((s) => s.isMatch).map((s) => s.text)).toEqual([
      'the tricky part was',
    ]);
    expect(view.caption).toBeUndefined();
  });

  it('trusts the saved result over the highlight and offers another try when it was missed', () => {
    const view = describeResult(missed, { tag: 'saved' }, 'improving');
    expect(view).toMatchObject({
      tone: 'not-yet',
      title: 'Not yet',
      hint: { text: 'The wording didn’t come up this time. It’ll be back tomorrow.' },
      showsModel: true,
      canTryAgain: true,
    });
    expect(view.segments).toEqual([{ text: missed.transcript, isMatch: false }]);
  });

  it('does not invent a status change when the status before is unknown', () => {
    expect(describeResult(used, { tag: 'saved' }, null).hint.lead).toBe('Now improving');
  });
});

describe('describeResult for a practice try', () => {
  it('never claims the saved result changed', () => {
    const better = describeResult(
      missed,
      { tag: 'tried', transcript: 'Well, the tricky part was the wifi.' },
      'learning',
    );
    expect(better).toMatchObject({
      tone: 'used',
      title: 'The wording came up this time',
      caption: 'Practice try',
      canTryAgain: false,
    });
    expect(better.hint.text).toContain('Your saved result stays');
    expect(better.hint.lead).toBeUndefined();
  });

  it('offers the model and another try when the wording is still missing', () => {
    const view = describeResult(used, { tag: 'tried', transcript: 'Nothing useful.' }, null);
    expect(view).toMatchObject({ tone: 'not-yet', showsModel: true, canTryAgain: true });
  });
});
