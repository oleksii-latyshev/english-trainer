import { describe, expect, it } from 'bun:test';
import { formatTiming, hasTiming } from '.';

describe('speech pipeline timing', () => {
  it('rounds to whole milliseconds and shows a dash when a stage was not measured', () => {
    expect(formatTiming(412.6)).toBe('413 ms');
    expect(formatTiming(undefined)).toBe('—');
  });

  it('shows the panel once any stage was measured', () => {
    expect(hasTiming({})).toBe(false);
    expect(hasTiming({ firstAiAudioMs: 900 })).toBe(true);
  });
});
