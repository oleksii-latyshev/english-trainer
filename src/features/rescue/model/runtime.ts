import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { RescueService } from '../services/rescue-service';

export const runtime = Atom.runtime(RescueService.layer.pipe(Layer.provide(CoreLive)));
