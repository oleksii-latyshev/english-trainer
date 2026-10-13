import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { SpeakingActivityService } from '../services/speaking-activity-service';

export const runtime = Atom.runtime(SpeakingActivityService.layer.pipe(Layer.provide(CoreLive)));
