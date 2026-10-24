import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { TextTranslationService } from '../services/text-translation-service';

export const runtime = Atom.runtime(TextTranslationService.layer.pipe(Layer.provide(CoreLive)));
