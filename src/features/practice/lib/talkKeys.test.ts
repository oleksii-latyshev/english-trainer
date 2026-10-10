// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  decideKeyDown,
  decideKeyUp,
  type KeyContext,
  type KeyPress,
  shouldKeepTurnOpen,
} from './talkKeys';
import type { TurnState } from './turnState';

const IDLE_CONTEXT: KeyContext = {
  state: { tag: 'idle' },
  canPressMic: true,
  isCountingDown: false,
  helpLevel: null,
  isHelpAvailable: true,
  isHoldingSpace: false,
};

function press(key: string, patch: Partial<KeyPress> = {}): KeyPress {
  return { key, isRepeat: false, hasModifier: false, target: 'other', ...patch };
}

function down(
  key: string,
  state: TurnState,
  patch: Partial<KeyContext> = {},
  p?: Partial<KeyPress>,
) {
  return decideKeyDown(press(key, p), { ...IDLE_CONTEXT, state, ...patch });
}

const LIVE_AUTO: TurnState = { tag: 'auto-listen', isLive: true, isHeld: false };
const LIVE_MANUAL: TurnState = { tag: 'listening', isLive: true, isHeld: false };

describe('Space hold-to-talk', () => {
  it('starts listening from idle, review, error and while Eva speaks', () => {
    for (const state of [
      { tag: 'idle' },
      { tag: 'review' },
      { tag: 'speaking' },
      { tag: 'thinking' },
      { tag: 'error', issue: { message: 'x', kind: 'reply', fixes: ['retry-send'] } },
    ] as TurnState[]) {
      expect(down(' ', state)).toEqual({ kind: 'hold-to-talk' });
    }
  });

  it('follows the microphone button: nothing while it is disabled, busy or not a turn state', () => {
    expect(down(' ', { tag: 'idle' }, { canPressMic: false })).toBeNull();
    for (const state of [{ tag: 'transcribing' }, { tag: 'paused' }] as TurnState[]) {
      expect(down(' ', state)).toBeNull();
    }
  });

  it('ignores a repeat, a modifier, a text field and a focused control', () => {
    expect(down(' ', { tag: 'idle' }, {}, { isRepeat: true })).toBeNull();
    expect(down(' ', { tag: 'idle' }, {}, { hasModifier: true })).toBeNull();
    expect(down(' ', { tag: 'idle' }, {}, { target: 'text' })).toBeNull();
    expect(down(' ', { tag: 'idle' }, {}, { target: 'control' })).toBeNull();
  });

  it('keeps auto-listen as push-to-talk but leaves a manual recording alone', () => {
    expect(down(' ', LIVE_AUTO)).toEqual({ kind: 'adopt-listening' });
    expect(down(' ', LIVE_MANUAL)).toBeNull();
    expect(down(' ', { tag: 'auto-listen', isLive: false, isHeld: false })).toBeNull();
  });

  it('stops on release only when the hold began, and abandons a release before the mic is live', () => {
    const held = { isHoldingSpace: true };
    expect(decideKeyUp(' ', { state: LIVE_MANUAL, ...held })).toBe('stop-listening');
    expect(decideKeyUp(' ', { state: LIVE_AUTO, ...held })).toBe('stop-listening');
    expect(
      decideKeyUp(' ', { state: { tag: 'listening', isLive: false, isHeld: false }, ...held }),
    ).toBe('cancel-listening');
    expect(decideKeyUp(' ', { state: LIVE_MANUAL, isHoldingSpace: false })).toBeNull();
    expect(decideKeyUp(' ', { state: { tag: 'transcribing' }, ...held })).toBeNull();
    expect(decideKeyUp('a', { state: LIVE_MANUAL, ...held })).toBeNull();
  });
});

describe('Escape', () => {
  it('cancels live listening, the countdown, or Eva speaking', () => {
    expect(down('Escape', LIVE_MANUAL)).toEqual({ kind: 'cancel-listening' });
    expect(down('Escape', LIVE_AUTO)).toEqual({ kind: 'cancel-listening' });
    expect(down('Escape', { tag: 'review' }, { isCountingDown: true })).toEqual({
      kind: 'cancel-countdown',
    });
    expect(down('Escape', { tag: 'speaking' })).toEqual({ kind: 'stop-eva' });
  });

  it('does nothing when there is nothing to cancel', () => {
    expect(down('Escape', { tag: 'idle' })).toBeNull();
    expect(down('Escape', { tag: 'review' })).toBeNull();
    expect(down('Escape', { tag: 'thinking' })).toEqual({ kind: 'stop-eva' });
  });

  it('works from a text field because it never types', () => {
    expect(down('Escape', { tag: 'speaking' }, {}, { target: 'text' })).toEqual({
      kind: 'stop-eva',
    });
  });
});

describe('help keys', () => {
  it('H opens the first level, then closes; 2 and 3 pick a level and toggle it', () => {
    const idle: TurnState = { tag: 'idle' };
    expect(down('h', idle)).toEqual({ kind: 'set-help', level: 'phrases' });
    expect(down('H', idle, { helpLevel: 'example' })).toEqual({ kind: 'set-help', level: null });
    expect(down('2', idle)).toEqual({ kind: 'set-help', level: 'phrases' });
    expect(down('3', idle, { helpLevel: 'phrases' })).toEqual({
      kind: 'set-help',
      level: 'example',
    });
    expect(down('3', idle, { helpLevel: 'example' })).toEqual({ kind: 'set-help', level: null });
  });

  it('leaves Frame (1) alone and ignores keys without help, in text fields or with a modifier', () => {
    const idle: TurnState = { tag: 'idle' };
    expect(down('1', idle)).toBeNull();
    expect(down('h', idle, { isHelpAvailable: false })).toBeNull();
    expect(down('h', idle, {}, { target: 'text' })).toBeNull();
    expect(down('h', idle, {}, { hasModifier: true })).toBeNull();
    expect(down('h', idle, {}, { isRepeat: true })).toBeNull();
  });
});

describe('shouldKeepTurnOpen', () => {
  it('holds the turn open only while Space is down and audio is flowing', () => {
    expect(shouldKeepTurnOpen(LIVE_MANUAL, true)).toBe(true);
    expect(shouldKeepTurnOpen(LIVE_AUTO, true)).toBe(true);
    expect(shouldKeepTurnOpen(LIVE_MANUAL, false)).toBe(false);
    expect(shouldKeepTurnOpen({ tag: 'listening', isLive: false, isHeld: false }, true)).toBe(
      false,
    );
    expect(shouldKeepTurnOpen({ tag: 'idle' }, true)).toBe(false);
  });

  it('does not ask again once the turn is already held', () => {
    expect(shouldKeepTurnOpen({ tag: 'listening', isLive: true, isHeld: true }, true)).toBe(false);
  });
});
