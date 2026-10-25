import { describe, expect, it } from 'bun:test';
import { formatDuration } from './index';

describe('formatDuration', () => {
  it('writes minutes and seconds without empty units', () => {
    expect(formatDuration(624_000)).toBe('10 min 24 s');
    expect(formatDuration(290_000)).toBe('4 min 50 s');
    expect(formatDuration(240_000)).toBe('4 min');
    expect(formatDuration(24_400)).toBe('24 s');
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
    expect(formatDuration(3_600_000)).toBe('1 h');
  });

  it('rounds to the nearest second', () => {
    expect(formatDuration(59_600)).toBe('1 min');
  });
});
