import type { TurnState } from './turnState';

export type ComposerInteraction = 'voice' | 'writing' | 'spoken_rehearsal';

export function canEditDraft(
  state: TurnState,
  hasDraft: boolean,
  isTyping: boolean,
  interaction: ComposerInteraction,
): boolean {
  if (interaction === 'writing') return true;
  if (state.tag === 'review') return true;
  if (state.tag === 'idle') return hasDraft || isTyping;
  if (state.tag === 'error' || state.tag === 'paused') return hasDraft || isTyping;
  return false;
}

export function canOfferTypeInstead(
  state: TurnState,
  isEditing: boolean,
  interaction: ComposerInteraction,
): boolean {
  return (
    interaction === 'voice' &&
    !isEditing &&
    (state.tag === 'idle' || state.tag === 'error' || state.tag === 'paused')
  );
}
