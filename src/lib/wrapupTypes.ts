import { isPhraseCardRecord, type PhraseCardRecord } from './learningTypes';
import { isProviderError, type ProviderError } from './types';

export type WrapupPreparation =
  | { state: 'legacy' }
  | { state: 'pending' }
  | { state: 'ready' }
  | { state: 'failed'; error: ProviderError };

export function isWrapupPreparation(value: unknown): value is WrapupPreparation {
  if (typeof value !== 'object' || value === null || !('state' in value)) return false;
  switch (value.state) {
    case 'legacy':
    case 'pending':
    case 'ready':
      return true;
    case 'failed':
      return 'error' in value && isProviderError(value.error);
    default:
      return false;
  }
}

export const WRAPUP_UPDATED_EVENT = 'wrapup-updated';

export type WrapupEvent = { session_id: number };

export function isWrapupEvent(value: unknown): value is WrapupEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'session_id' in value &&
    typeof value.session_id === 'number' &&
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0
  );
}

export type SavedWrapupPhrases = { cards: PhraseCardRecord[]; created_ids: number[] };

export function isSavedWrapupPhrases(value: unknown): value is SavedWrapupPhrases {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('cards' in value) ||
    !Array.isArray(value.cards) ||
    value.cards.length < 1 ||
    value.cards.length > 3 ||
    !value.cards.every(isPhraseCardRecord) ||
    !('created_ids' in value) ||
    !Array.isArray(value.created_ids) ||
    value.created_ids.length > 3 ||
    !value.created_ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
  ) {
    return false;
  }
  const cardIds = value.cards.map((card) => card.id);
  return (
    new Set(cardIds).size === cardIds.length &&
    new Set(value.created_ids).size === value.created_ids.length &&
    value.created_ids.every((id) => cardIds.includes(id))
  );
}
