import type { KeyTarget } from '@/components/keyTarget';

export type ReviewKeyPress = {
  key: string;
  isRepeat: boolean;
  /** Ctrl, Alt or Meta is down; Shift alone does not count. */
  hasModifier: boolean;
  target: KeyTarget;
};

export type ReviewKeyContext = {
  /** An answer can be started now. */
  canStart: boolean;
  listening: 'no' | 'starting' | 'live';
  isEvaSpeaking: boolean;
  /** Space went down earlier and has not come back up. */
  isHoldingSpace: boolean;
};

export type ReviewKeyCommand =
  | { kind: 'hold-to-talk' }
  | { kind: 'cancel-listening' }
  | { kind: 'stop-eva' };

/**
 * The spoken review's keys, the same ones Talk uses: hold Space to answer, Esc to cancel the
 * answer or to stop Eva. Esc never types, so it works from a text field too; a focused button or
 * link keeps Space for itself.
 */
export function decideReviewKeyDown(
  press: ReviewKeyPress,
  context: ReviewKeyContext,
): ReviewKeyCommand | null {
  if (press.hasModifier || press.isRepeat) return null;
  if (press.key === 'Escape') {
    if (context.listening !== 'no') return { kind: 'cancel-listening' };
    return context.isEvaSpeaking ? { kind: 'stop-eva' } : null;
  }
  if (press.key !== ' ' || press.target !== 'other') return null;
  if (context.listening !== 'no' || !context.canStart) return null;
  return { kind: 'hold-to-talk' };
}

/** Letting go of Space ends a hold-to-talk answer; letting go before the microphone is live abandons it. */
export function decideReviewKeyUp(
  key: string,
  context: Pick<ReviewKeyContext, 'listening' | 'isHoldingSpace'>,
): 'stop-listening' | 'cancel-listening' | null {
  if (key !== ' ' || !context.isHoldingSpace || context.listening === 'no') return null;
  return context.listening === 'live' ? 'stop-listening' : 'cancel-listening';
}
