import type { KeyTarget } from '@/shared/helpers/key-target';
import type { TurnState } from '../turn-state';

export type KeyPress = {
  key: string;
  isRepeat: boolean;
  hasModifier: boolean;
  target: KeyTarget;
};

export type KeyContext = {
  state: TurnState;
  canPressMic: boolean;
  isCountingDown: boolean;
  isHoldingSpace: boolean;
};

export type KeyCommand =
  | { kind: 'hold-to-talk' }
  | { kind: 'adopt-listening' }
  | { kind: 'cancel-listening' }
  | { kind: 'cancel-countdown' }
  | { kind: 'stop-eva' };

const STARTABLE: TurnState['tag'][] = ['idle', 'review', 'thinking', 'speaking', 'error'];

function isLiveListening(state: TurnState): boolean {
  return (state.tag === 'listening' || state.tag === 'auto-listen') && state.isLive;
}

function spaceDown(press: KeyPress, context: KeyContext): KeyCommand | null {
  if (press.target !== 'other' || press.isRepeat) return null;
  if (isLiveListening(context.state)) {
    return context.state.tag === 'auto-listen' ? { kind: 'adopt-listening' } : null;
  }
  if (!STARTABLE.includes(context.state.tag) || !context.canPressMic) return null;
  return { kind: 'hold-to-talk' };
}

function escapeDown(context: KeyContext): KeyCommand | null {
  const { state } = context;
  if (isLiveListening(state)) return { kind: 'cancel-listening' };
  if (state.tag === 'review' && context.isCountingDown) return { kind: 'cancel-countdown' };
  if (state.tag === 'speaking' || state.tag === 'thinking') return { kind: 'stop-eva' };
  return null;
}

export function decideKeyDown(press: KeyPress, context: KeyContext): KeyCommand | null {
  if (press.hasModifier) return null;
  if (press.key === 'Escape') return press.isRepeat ? null : escapeDown(context);
  if (press.target === 'text') return null;
  if (press.key === ' ') return spaceDown(press, context);
  return null;
}

export function decideKeyUp(
  key: string,
  context: Pick<KeyContext, 'state' | 'isHoldingSpace'>,
): 'stop-listening' | 'cancel-listening' | null {
  if (key !== ' ' || !context.isHoldingSpace) return null;
  const { state } = context;
  if (state.tag !== 'listening' && state.tag !== 'auto-listen') return null;
  return state.isLive ? 'stop-listening' : 'cancel-listening';
}

export function shouldKeepTurnOpen(state: TurnState, isHoldingSpace: boolean): boolean {
  if (!isHoldingSpace) return false;
  if (state.tag !== 'listening' && state.tag !== 'auto-listen') return false;
  return state.isLive && !state.isHeld;
}
