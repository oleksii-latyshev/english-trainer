import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { LearningMemoryService } from '../services/learning-memory-service';

export const runtime = Atom.runtime(LearningMemoryService.layer.pipe(Layer.provide(CoreLive)));
