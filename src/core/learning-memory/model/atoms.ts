import { Data, Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { LearningMemoryService } from '../services/learning-memory-service';
import type { LearningItemRef } from '../types';
import { runtime } from './runtime';

export const LEARNING_MEMORY = ['learning-memory'];

class EvidenceKey extends Data.Class<LearningItemRef> {}

export function evidenceKey(ref: LearningItemRef): LearningItemRef {
  return new EvidenceKey(ref);
}

export const learningMemoryAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* LearningMemoryService;
      return yield* service.read;
    }),
  )
  .pipe(Atom.runtime.withReactivity(LEARNING_MEMORY));

export const openedLearningMemoryAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* LearningMemoryService;
      return yield* service.open;
    }),
  )
  .pipe(Atom.runtime.withReactivity(LEARNING_MEMORY));

export const memoryUsageEvidenceAtom = Atom.family((ref: LearningItemRef) =>
  runtime
    .atom(
      Effect.gen(function* () {
        const service = yield* LearningMemoryService;
        return yield* service.usageEvidence(ref);
      }),
    )
    .pipe(Atom.runtime.withReactivity(LEARNING_MEMORY)),
);
