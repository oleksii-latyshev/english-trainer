import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { SpokenRecallService } from '../services/spoken-recall-service';

export const runtime = Atom.runtime(SpokenRecallService.layer.pipe(Layer.provide(CoreLive)));
