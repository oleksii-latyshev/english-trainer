import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { TranslationSettingsService } from '../services/translation-settings-service';

export const runtime = Atom.runtime(TranslationSettingsService.layer.pipe(Layer.provide(CoreLive)));
