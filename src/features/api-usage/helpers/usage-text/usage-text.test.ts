import { expect, it } from 'bun:test';
import { dailyCountResetText, formatRemaining, quotaResetText } from '.';

it('reads remaining time as hours and minutes, rounding down', () => {
  expect(formatRemaining(4 * 3_600_000 + 44 * 60_000 + 53_000)).toBe('4 h 44 min');
  expect(formatRemaining(2 * 3_600_000)).toBe('2 h');
  expect(formatRemaining(12 * 60_000)).toBe('12 min');
  expect(formatRemaining(59_000)).toBe('under a minute');
  expect(formatRemaining(-5)).toBe('under a minute');
});

it('says when the Antigravity quota returns, or that it has', () => {
  expect(quotaResetText(1_000 + 17_093_000, 1_000)).toBe('Resets in 4 h 44 min.');
  expect(quotaResetText(500, 1_000)).toBe('The quota should be back by now.');
  expect(quotaResetText(null, 1_000)).toBe('Antigravity did not say when it resets.');
});

it('explains when the daily Gemini count starts over', () => {
  expect(dailyCountResetText(7 * 3_600_000 + 12 * 60_000, 0)).toBe(
    'Counted by this app. The daily count starts over at midnight Pacific time, in 7 h 12 min.',
  );
});
