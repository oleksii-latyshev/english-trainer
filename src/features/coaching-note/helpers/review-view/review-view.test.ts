import { describe, expect, it } from 'bun:test';
import type { TurnFeedback } from '../../types';
import { reviewView } from '.';

const feedback: TurnFeedback = { focus_feedback: [], b2_rewrite: 'Every bank sends them.' };

describe('reviewView', () => {
  it('turns each coaching state into what the review shows', () => {
    expect(reviewView({ state: 'pending' })).toEqual({ tag: 'pending' });
    expect(reviewView({ state: 'paused' })).toEqual({ tag: 'paused' });
    expect(reviewView({ state: 'failed' })).toEqual({ tag: 'failed' });
    expect(reviewView({ state: 'ready', feedback })).toEqual({ tag: 'ready', feedback });
  });

  it('treats an answer without a coaching state as one that could not be checked', () => {
    expect(reviewView(undefined)).toEqual({ tag: 'failed' });
  });
});
