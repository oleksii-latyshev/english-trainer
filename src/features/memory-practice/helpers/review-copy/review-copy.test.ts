import { describe, expect, it } from 'bun:test';
import { reviewCopy } from './index';

describe('spoken review card copy', () => {
  it('offers a review with the due count', () => {
    expect(reviewCopy(4, { tag: 'none' })).toMatchObject({
      state: 'due',
      title: '4 items are waiting',
      hint: 'About 2 minutes. Say each one in a sentence of your own.',
      actionLabel: 'Start spoken review',
    });
    expect(reviewCopy(1, { tag: 'none' }).title).toBe('1 item is waiting');
  });

  it('rests calmly when nothing is due, without an action', () => {
    expect(reviewCopy(0, { tag: 'none' })).toMatchObject({
      state: 'calm',
      title: 'All caught up',
      actionLabel: null,
    });
  });

  it('offers to resume a saved review before anything else', () => {
    const resume = reviewCopy(0, { tag: 'saved', resolved: 1, total: 3 });
    expect(resume).toMatchObject({ state: 'resume', actionLabel: 'Resume review' });
    expect(resume.hint).toContain('1 of 3');
    expect(reviewCopy(5, { tag: 'saved', resolved: 0, total: 3 }).state).toBe('resume');
  });
});
