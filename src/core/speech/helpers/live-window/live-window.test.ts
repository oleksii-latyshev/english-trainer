import { describe, expect, it } from 'bun:test';
import { advanceLiveWindow, EMPTY_LIVE_WINDOW, joinLiveText, LIVE_COMMIT_AFTER_MS } from '.';

describe('live window', () => {
  it('joins committed and tail text with one space', () => {
    expect(joinLiveText('', ' hello ')).toBe('hello');
    expect(joinLiveText('hello ', '')).toBe('hello');
    expect(joinLiveText('hello', 'world')).toBe('hello world');
  });

  it('keeps the window while the tail is short', () => {
    const step = advanceLiveWindow(EMPTY_LIVE_WINDOW, 'I think', 5000);
    expect(step.text).toBe('I think');
    expect(step.window).toBe(EMPTY_LIVE_WINDOW);
  });

  it('commits the tail and moves the offset once it is long', () => {
    const step = advanceLiveWindow(EMPTY_LIVE_WINDOW, 'a long story', LIVE_COMMIT_AFTER_MS);
    expect(step.text).toBe('a long story');
    expect(step.window).toEqual({ committedText: 'a long story', offsetMs: LIVE_COMMIT_AFTER_MS });
  });

  it('measures the tail from the offset and shows committed text before it', () => {
    const committed = { committedText: 'first part', offsetMs: 20_000 };
    const early = advanceLiveWindow(committed, 'second', 30_000);
    expect(early.text).toBe('first part second');
    expect(early.window).toBe(committed);
    const late = advanceLiveWindow(committed, 'second part', 20_000 + LIVE_COMMIT_AFTER_MS);
    expect(late.window).toEqual({
      committedText: 'first part second part',
      offsetMs: 20_000 + LIVE_COMMIT_AFTER_MS,
    });
  });

  it('moves the offset even when the long tail is silent', () => {
    const step = advanceLiveWindow({ committedText: 'kept', offsetMs: 0 }, '', 25_000);
    expect(step.text).toBe('kept');
    expect(step.window).toEqual({ committedText: 'kept', offsetMs: 25_000 });
  });
});
