// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { formatSeconds, litBars } from './levelMeter';

describe('litBars', () => {
  it('lights none for silence or no reading', () => {
    expect(litBars(undefined, 12)).toBe(0);
    expect(litBars(0, 12)).toBe(0);
    expect(litBars(Number.NaN, 12)).toBe(0);
  });

  it('scales the level to the bar count and caps it', () => {
    expect(litBars(0.5, 12)).toBe(6);
    expect(litBars(1, 12)).toBe(12);
    expect(litBars(3, 12)).toBe(12);
  });
});

describe('formatSeconds', () => {
  it('formats milliseconds as seconds', () => {
    expect(formatSeconds(620, 2)).toBe('0.62 s');
    expect(formatSeconds(1400, 1)).toBe('1.4 s');
  });
});
