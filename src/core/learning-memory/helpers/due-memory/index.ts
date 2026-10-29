import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { PhraseCardRecord } from '@/core/ipc';
import type { LearningMemory } from '../../types';

export type DueMemory =
  | { readonly tag: 'loading' }
  | {
      readonly tag: 'ready';
      readonly dueCount: number;
      readonly nextDuePhrase: PhraseCardRecord | undefined;
    }
  | { readonly tag: 'unavailable' };

export function dueMemory(result: AsyncResult.AsyncResult<LearningMemory, unknown>): DueMemory {
  const view = Option.getOrNull(AsyncResult.value(result));
  if (view) {
    return {
      tag: 'ready',
      dueCount: view.due_count,
      nextDuePhrase: view.phrase_cards.find((card) => card.is_due),
    };
  }
  return AsyncResult.isFailure(result) ? { tag: 'unavailable' } : { tag: 'loading' };
}
