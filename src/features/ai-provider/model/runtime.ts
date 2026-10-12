import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { ResponseTestService } from '../services/response-test-service';

export const runtime = Atom.runtime(ResponseTestService.layer.pipe(Layer.provide(CoreLive)));
