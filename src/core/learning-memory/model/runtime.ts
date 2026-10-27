import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { LearningMemoryService } from '../services/learning-memory-service';
import { ReviewRunService } from '../services/review-run-service';

const LearningMemoryLive = Layer.mergeAll(LearningMemoryService.layer, ReviewRunService.layer).pipe(
  Layer.provide(CoreLive),
);

export const runtime = Atom.runtime(LearningMemoryLive);
