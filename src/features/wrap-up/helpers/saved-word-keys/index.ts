import type { PhraseCard } from '../../types';
import { wordKey } from '../word-key';

export function savedWordKeys(cards: readonly PhraseCard[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const card of cards) {
    if (card.session_id === null || card.sequence === null) continue;
    keys.add(wordKey(card.session_id, { sequence: card.sequence, phrase: card.phrase }));
  }
  return keys;
}
