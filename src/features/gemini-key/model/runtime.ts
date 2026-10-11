import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { GeminiKeyService } from '../services/gemini-key-service';

export const runtime = Atom.runtime(GeminiKeyService.layer.pipe(Layer.provide(CoreLive)));
