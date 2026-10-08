// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { isApiUsageOverview } from './apiUsageTypes';

const note = { occurred_at_ms: 1, model: 'm', message: 'quota', resets_at_ms: null };
const overview = {
  day: '2027-01-15',
  gemini: {
    models: [{ model: 'gemini-3.5-flash-lite', requests: 3 }],
    last_limit: note,
    resets_at_ms: 2,
  },
  antigravity: { requests_today: 4, last_quota_error: { ...note, resets_at_ms: 9 } },
};

describe('API usage payload', () => {
  it('accepts what Rust sends, with and without limit notes', () => {
    expect(isApiUsageOverview(overview)).toBe(true);
    expect(
      isApiUsageOverview({
        ...overview,
        gemini: { ...overview.gemini, models: [], last_limit: null },
        antigravity: { requests_today: 0, last_quota_error: null },
      }),
    ).toBe(true);
  });

  it('rejects malformed counts, notes and shapes', () => {
    expect(isApiUsageOverview(null)).toBe(false);
    expect(isApiUsageOverview({ ...overview, day: 5 })).toBe(false);
    expect(
      isApiUsageOverview({
        ...overview,
        gemini: { ...overview.gemini, models: [{ model: 'm', requests: -1 }] },
      }),
    ).toBe(false);
    expect(
      isApiUsageOverview({
        ...overview,
        antigravity: { requests_today: 1.5, last_quota_error: null },
      }),
    ).toBe(false);
    expect(
      isApiUsageOverview({
        ...overview,
        antigravity: { requests_today: 1, last_quota_error: { ...note, message: 7 } },
      }),
    ).toBe(false);
    expect(
      isApiUsageOverview({ ...overview, gemini: { ...overview.gemini, last_limit: undefined } }),
    ).toBe(false);
  });
});
