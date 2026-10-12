import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { ApiUsageService } from '../services/api-usage-service';

export const runtime = Atom.runtime(ApiUsageService.layer.pipe(Layer.provide(CoreLive)));
