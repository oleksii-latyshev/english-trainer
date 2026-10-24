import { describe, expect, it } from 'bun:test';
import type { TurnCoaching } from '../../types';
import { coachingMarker } from '.';

const focus = {
  category: 'grammar' as const,
  original: 'I work in there',
  improved: 'I work there',
  explanation: 'Drop the extra preposition.',
};

function ready(count: number): TurnCoaching {
  return {
    state: 'ready',
    feedback: { focus_feedback: Array.from({ length: count }, () => focus), b2_rewrite: 'Better.' },
  };
}

describe('coaching marker', () => {
  it('stays faint while the answer is being checked', () => {
    expect(coachingMarker({ state: 'pending' })).toEqual({ kind: 'pending' });
  });

  it('counts the focus items of a ready review', () => {
    expect(coachingMarker(ready(1))).toEqual({ kind: 'label', text: '1 tip' });
    expect(coachingMarker(ready(2))).toEqual({ kind: 'label', text: '2 tips' });
  });

  it('says the answer looks good when there is nothing to fix', () => {
    expect(coachingMarker(ready(0))).toEqual({ kind: 'label', text: 'Looks good' });
  });

  it('shows nothing when coaching failed, is paused or unknown', () => {
    expect(coachingMarker({ state: 'failed' })).toBeUndefined();
    expect(coachingMarker({ state: 'paused' })).toBeUndefined();
    expect(coachingMarker(undefined)).toBeUndefined();
  });
});
