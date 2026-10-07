// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { formatAnswerDuration, formatReplyTime, spokenDurationMs } from './messageMeta';

describe('message meta formatting', () => {
  it('shows reply time with one decimal and nothing when unknown', () => {
    expect(formatReplyTime(800)).toBe('0.8 s');
    expect(formatReplyTime(1140)).toBe('1.1 s');
    expect(formatReplyTime(undefined)).toBeUndefined();
  });

  it('shows answer duration in whole seconds and nothing when unknown', () => {
    expect(formatAnswerDuration(14_000)).toBe('14 s');
    expect(formatAnswerDuration(14_600)).toBe('15 s');
    expect(formatAnswerDuration(undefined)).toBeUndefined();
  });

  it('sends a duration for voice and edited answers only', () => {
    expect(spokenDurationMs('voice', 14_000.4)).toBe(14_000);
    expect(spokenDurationMs('edited', 9_000)).toBe(9_000);
    expect(spokenDurationMs('text', 9_000)).toBeUndefined();
    expect(spokenDurationMs(undefined, 9_000)).toBeUndefined();
    expect(spokenDurationMs('voice', 0)).toBeUndefined();
  });
});
