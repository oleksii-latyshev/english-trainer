import type { KeyTarget } from '@/components/keyTarget';
import { type HelpLevel, helpLevelForKey } from './helpLevels';
import type { TurnState } from './turnState';

export type KeyPress = {
  key: string;
  isRepeat: boolean;
  /** Ctrl, Alt or Meta is down; Shift alone does not count. */
  hasModifier: boolean;
  target: KeyTarget;
};

export type KeyContext = {
  state: TurnState;
  /** The microphone control accepts a press right now (same rules as the button). */
  canPressMic: boolean;
  /** The auto-send countdown is running in the review state. */
  isCountingDown: boolean;
  helpLevel: HelpLevel | null;
  isHelpAvailable: boolean;
  /** Space went down earlier and has not come back up. */
  isHoldingSpace: boolean;
};

export type KeyCommand =
  /** Space down while the turn is free: listen for as long as Space is held. */
  | { kind: 'hold-to-talk' }
  /** Space down while auto-listen already records: the hold now ends the turn when released. */
  | { kind: 'adopt-listening' }
  | { kind: 'cancel-listening' }
  | { kind: 'cancel-countdown' }
  | { kind: 'stop-eva' }
  | { kind: 'set-help'; level: HelpLevel | null };

const STARTABLE: TurnState['tag'][] = ['idle', 'review', 'thinking', 'speaking', 'error'];

function isLiveListening(state: TurnState): boolean {
  return (state.tag === 'listening' || state.tag === 'auto-listen') && state.isLive;
}

function spaceDown(press: KeyPress, context: KeyContext): KeyCommand | null {
  // A focused button or switch uses Space itself; a held key repeats, and only the first press counts.
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

/** The one place that says which key does what in which turn state. */
export function decideKeyDown(press: KeyPress, context: KeyContext): KeyCommand | null {
  if (press.hasModifier) return null;
  // Esc never types, so it also works from a text field; every other key is typing there.
  if (press.key === 'Escape') return press.isRepeat ? null : escapeDown(context);
  if (press.target === 'text') return null;
  if (press.key === ' ') return spaceDown(press, context);
  if (press.isRepeat || !context.isHelpAvailable) return null;
  const help = helpLevelForKey(press.key, context.helpLevel);
  return help ? { kind: 'set-help', level: help.level } : null;
}

/** Releasing Space ends a hold-to-talk turn; a release before the microphone is live abandons it. */
export function decideKeyUp(
  key: string,
  context: Pick<KeyContext, 'state' | 'isHoldingSpace'>,
): 'stop-listening' | 'cancel-listening' | null {
  if (key !== ' ' || !context.isHoldingSpace) return null;
  const { state } = context;
  if (state.tag !== 'listening' && state.tag !== 'auto-listen') return null;
  return state.isLive ? 'stop-listening' : 'cancel-listening';
}

/** While Space is held the turn ends on release only, so silence must not end it. */
export function shouldKeepTurnOpen(state: TurnState, isHoldingSpace: boolean): boolean {
  if (!isHoldingSpace) return false;
  if (state.tag !== 'listening' && state.tag !== 'auto-listen') return false;
  return state.isLive && !state.isHeld;
}
