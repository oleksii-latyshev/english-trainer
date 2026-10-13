import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { isPracticableMistake, openedLearningMemoryAtom } from '@/core/learning-memory';

const SAMPLE_COUNT = 2;

export type PracticeTargets =
  | { readonly tag: 'loading' }
  | { readonly tag: 'unavailable' }
  | {
      readonly tag: 'ready';
      readonly dueCount: number;
      readonly practicableCount: number;
      readonly samples: readonly string[];
    };

export const practiceTargetsAtom = Atom.make((get): PracticeTargets => {
  const result = get(openedLearningMemoryAtom);
  const view = Option.getOrNull(AsyncResult.value(result));
  if (!view) return AsyncResult.isFailure(result) ? { tag: 'unavailable' } : { tag: 'loading' };
  const practicable = view.mistakes
    .filter(isPracticableMistake)
    .sort((a, b) => b.times_seen - a.times_seen);
  return {
    tag: 'ready',
    dueCount: view.due_count,
    practicableCount: practicable.length,
    samples: practicable.slice(0, SAMPLE_COUNT).map((mistake) => mistake.original_example),
  };
});
