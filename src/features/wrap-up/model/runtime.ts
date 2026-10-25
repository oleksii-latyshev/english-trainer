import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { LearningMemoryService } from '@/core/learning-memory';
import { CoreLive } from '@/core/runtime';
import { WrapUpService } from '../services/wrap-up-service';

export const runtime = Atom.runtime(
  Layer.mergeAll(WrapUpService.layer, LearningMemoryService.layer).pipe(Layer.provide(CoreLive)),
);
