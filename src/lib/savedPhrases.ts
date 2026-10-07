import type { PhraseCardRecord } from './learningTypes';

/**
 * Saving a phrase that is already in Memory returns the existing card. Only a card created by
 * this save may be offered an Undo; removing an older card would lose the learner's data.
 */
export function newlySavedCards(
  cards: readonly PhraseCardRecord[],
  requestedAtMs: number,
): PhraseCardRecord[] {
  return cards.filter((card) => card.created_at >= requestedAtMs);
}
