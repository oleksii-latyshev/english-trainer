import { describe, expect, it } from 'bun:test';
import { habitLine } from '.';

describe('habitLine', () => {
  it('shows the rate per 100 words in the earliest and the latest conversation', () => {
    expect(habitLine({ word: 'very', from_rate: 3.4, to_rate: 1.2 })).toBe(
      'very 3.4 → 1.2 per 100 words',
    );
  });

  it('keeps one decimal for whole and zero rates', () => {
    expect(habitLine({ word: 'make', from_rate: 2, to_rate: 0 })).toBe(
      'make 2.0 → 0.0 per 100 words',
    );
  });
});
