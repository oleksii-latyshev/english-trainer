import type { KeyTarget } from '@/shared/helpers/key-target';

export type ReviewKeyPress = {
  readonly key: string;
  readonly isRepeat: boolean;
  readonly hasModifier: boolean;
  readonly target: KeyTarget;
};

export type ReviewKeyContext = {
  readonly canStart: boolean;
  readonly listening: 'no' | 'starting' | 'live';
  readonly isEvaSpeaking: boolean;
  readonly isHoldingSpace: boolean;
};

export type ReviewKeyCommand =
  | { readonly kind: 'hold-to-talk' }
  | { readonly kind: 'cancel-listening' }
  | { readonly kind: 'stop-eva' };

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

export function decideReviewKeyUp(
  key: string,
  context: Pick<ReviewKeyContext, 'listening' | 'isHoldingSpace'>,
): 'stop-listening' | 'cancel-listening' | null {
  if (key !== ' ' || !context.isHoldingSpace || context.listening === 'no') return null;
  return context.listening === 'live' ? 'stop-listening' : 'cancel-listening';
}
