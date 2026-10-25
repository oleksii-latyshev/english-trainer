import type { FinishedSession } from '../../types';

export type PreparationView =
  | { readonly tag: 'failed'; readonly message: string }
  | { readonly tag: 'prepare'; readonly message: string | undefined }
  | { readonly tag: 'error'; readonly message: string }
  | { readonly tag: 'empty'; readonly message: string }
  | { readonly tag: 'none' };

const WAITING = 'Phrases appear here when Eva coaches an answer.';
const PENDING = 'Preparing phrases from your answers…';
const READY_EMPTY = 'No phrases to keep from this session.';

function emptyMessage(preparation: FinishedSession['wrapup_preparation']): string {
  if (preparation.state === 'pending') return PENDING;
  if (preparation.state === 'ready') return READY_EMPTY;
  return WAITING;
}

export function preparationView(
  summary: FinishedSession,
  retryMessage: string | undefined,
): PreparationView {
  const preparation = summary.wrapup_preparation;
  if (preparation.state === 'failed') {
    return { tag: 'failed', message: retryMessage ?? preparation.error.message };
  }
  if (preparation.state === 'legacy') return { tag: 'prepare', message: retryMessage };
  if (retryMessage) return { tag: 'error', message: retryMessage };
  if (summary.phrases.length > 0) return { tag: 'none' };
  return { tag: 'empty', message: emptyMessage(preparation) };
}

export function canSavePhrases(preparation: FinishedSession['wrapup_preparation']): boolean {
  return preparation.state !== 'pending' && preparation.state !== 'failed';
}
