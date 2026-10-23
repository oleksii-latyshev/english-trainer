import { describe, expect, it } from 'bun:test';
import { formatAnswerDuration, formatReplyTime, inputSourceLabel } from '.';

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

  it('names how an answer was given', () => {
    expect(inputSourceLabel('voice')).toBe('spoken');
    expect(inputSourceLabel('text')).toBe('typed');
    expect(inputSourceLabel('edited')).toBe('edited');
    expect(inputSourceLabel(undefined)).toBeUndefined();
  });
});
