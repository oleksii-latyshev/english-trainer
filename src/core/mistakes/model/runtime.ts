import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { MistakesService } from '../services/mistakes-service';

export const runtime = Atom.runtime(MistakesService.layer.pipe(Layer.provide(CoreLive)));
