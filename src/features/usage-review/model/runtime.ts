import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { UsageReviewService } from '../services/usage-review-service';

export const runtime = Atom.runtime(UsageReviewService.layer.pipe(Layer.provide(CoreLive)));
