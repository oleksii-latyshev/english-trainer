import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { PrivacyService } from '../services/privacy-service';

export const runtime = Atom.runtime(PrivacyService.layer.pipe(Layer.provide(CoreLive)));
