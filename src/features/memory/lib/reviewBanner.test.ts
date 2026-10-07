// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { reviewBannerCopy } from './reviewBanner';

describe('review banner', () => {
  it('offers a review with the due count', () => {
    expect(reviewBannerCopy(6, { tag: 'none' })).toMatchObject({
      state: 'due',
      title: 'Spoken review · 6 due',
      actionLabel: 'Review now',
    });
  });

  it('rests calmly when nothing is due, without an action', () => {
    expect(reviewBannerCopy(0, { tag: 'none' })).toMatchObject({
      state: 'calm',
      title: 'Spoken review · all caught up',
      actionLabel: null,
    });
  });

  it('offers to resume a saved review before anything else', () => {
    const resume = reviewBannerCopy(0, { tag: 'saved', resolved: 1, total: 3 });
    expect(resume).toMatchObject({ state: 'resume', actionLabel: 'Resume review' });
    expect(resume.hint).toContain('1 of 3');
    expect(reviewBannerCopy(5, { tag: 'saved', resolved: 0, total: 3 }).state).toBe('resume');
  });
});
