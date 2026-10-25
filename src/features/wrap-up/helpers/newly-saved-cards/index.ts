import type { PhraseCard } from '../../types';

export function newlySavedCards(
  cards: readonly PhraseCard[],
  requestedAtMs: number,
): readonly PhraseCard[] {
  return cards.filter((card) => card.created_at >= requestedAtMs);
}
