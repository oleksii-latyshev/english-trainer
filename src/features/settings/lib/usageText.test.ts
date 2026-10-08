// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { formatRemaining, quotaResetText, requestsLabel } from './usageText';

describe('formatRemaining', () => {
  it('reads as hours and minutes, rounding down', () => {
    expect(formatRemaining(4 * 3_600_000 + 44 * 60_000 + 53_000)).toBe('4 h 44 min');
    expect(formatRemaining(2 * 3_600_000)).toBe('2 h');
    expect(formatRemaining(12 * 60_000)).toBe('12 min');
    expect(formatRemaining(59_000)).toBe('under a minute');
    expect(formatRemaining(-5)).toBe('under a minute');
  });
});

describe('quotaResetText', () => {
  it('says when the quota returns, or that it has', () => {
    expect(quotaResetText(1_000 + 17_093_000, 1_000)).toBe('Resets in 4 h 44 min.');
    expect(quotaResetText(500, 1_000)).toBe('The quota should be back by now.');
    expect(quotaResetText(null, 1_000)).toBe('Antigravity did not say when it resets.');
  });
});

describe('requestsLabel', () => {
  it('is singular for one', () => {
    expect(requestsLabel(1)).toBe('1 request');
    expect(requestsLabel(0)).toBe('0 requests');
    expect(requestsLabel(12)).toBe('12 requests');
  });
});
