// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  decideReviewKeyDown,
  decideReviewKeyUp,
  type ReviewKeyContext,
  type ReviewKeyPress,
} from './reviewKeys';

const press = (key: string, extra: Partial<ReviewKeyPress> = {}): ReviewKeyPress => ({
  key,
  isRepeat: false,
  hasModifier: false,
  target: 'other',
  ...extra,
});

const ready: ReviewKeyContext = {
  canStart: true,
  listening: 'no',
  isEvaSpeaking: false,
  isHoldingSpace: false,
};

describe('review keys', () => {
  it('starts an answer on Space while nothing else is happening', () => {
    expect(decideReviewKeyDown(press(' '), ready)).toEqual({ kind: 'hold-to-talk' });
    expect(decideReviewKeyDown(press(' '), { ...ready, isEvaSpeaking: true })).toEqual({
      kind: 'hold-to-talk',
    });
  });

  it('leaves Space to buttons, text fields, held keys and modifier shortcuts', () => {
    expect(decideReviewKeyDown(press(' ', { target: 'control' }), ready)).toBeNull();
    expect(decideReviewKeyDown(press(' ', { target: 'text' }), ready)).toBeNull();
    expect(decideReviewKeyDown(press(' ', { isRepeat: true }), ready)).toBeNull();
    expect(decideReviewKeyDown(press(' ', { hasModifier: true }), ready)).toBeNull();
    expect(decideReviewKeyDown(press(' '), { ...ready, canStart: false })).toBeNull();
    expect(decideReviewKeyDown(press(' '), { ...ready, listening: 'live' })).toBeNull();
  });

  it('cancels the answer, or else stops Eva, on Escape', () => {
    expect(decideReviewKeyDown(press('Escape'), { ...ready, listening: 'live' })).toEqual({
      kind: 'cancel-listening',
    });
    expect(decideReviewKeyDown(press('Escape'), { ...ready, listening: 'starting' })).toEqual({
      kind: 'cancel-listening',
    });
    expect(decideReviewKeyDown(press('Escape'), { ...ready, isEvaSpeaking: true })).toEqual({
      kind: 'stop-eva',
    });
    expect(decideReviewKeyDown(press('Escape'), ready)).toBeNull();
    expect(
      decideReviewKeyDown(press('Escape', { target: 'text' }), { ...ready, isEvaSpeaking: true }),
    ).toEqual({
      kind: 'stop-eva',
    });
  });

  it('ignores other keys', () => {
    expect(decideReviewKeyDown(press('h'), ready)).toBeNull();
  });

  it('ends a held answer on release, or abandons it before the microphone is live', () => {
    const held = { isHoldingSpace: true };
    expect(decideReviewKeyUp(' ', { ...held, listening: 'live' })).toBe('stop-listening');
    expect(decideReviewKeyUp(' ', { ...held, listening: 'starting' })).toBe('cancel-listening');
    expect(decideReviewKeyUp(' ', { ...held, listening: 'no' })).toBeNull();
    expect(decideReviewKeyUp(' ', { isHoldingSpace: false, listening: 'live' })).toBeNull();
    expect(decideReviewKeyUp('a', { ...held, listening: 'live' })).toBeNull();
  });
});
