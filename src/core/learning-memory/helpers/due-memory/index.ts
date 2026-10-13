import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { MistakeRecord, PhraseCardRecord } from '@/core/ipc';
import type { LearningMemory } from '../../types';
import { isPracticableMistake } from '../practicable-mistake';

const SHOWN_MISTAKES = 3;

export type DueMemory =
  | { readonly tag: 'loading' }
  | {
      readonly tag: 'ready';
      readonly dueCount: number;
      readonly nextDuePhrase: PhraseCardRecord | undefined;
      readonly usualMistakes: readonly MistakeRecord[];
    }
  | { readonly tag: 'unavailable' };

function usualMistakes(view: LearningMemory): readonly MistakeRecord[] {
  return view.mistakes
    .filter(isPracticableMistake)
    .sort((a, b) => b.times_seen - a.times_seen)
    .slice(0, SHOWN_MISTAKES);
}

export function dueMemory(result: AsyncResult.AsyncResult<LearningMemory, unknown>): DueMemory {
  const view = Option.getOrNull(AsyncResult.value(result));
  if (view) {
    return {
      tag: 'ready',
      dueCount: view.due_count,
      nextDuePhrase: view.phrase_cards.find((card) => card.is_due),
      usualMistakes: usualMistakes(view),
    };
  }
  return AsyncResult.isFailure(result) ? { tag: 'unavailable' } : { tag: 'loading' };
}
