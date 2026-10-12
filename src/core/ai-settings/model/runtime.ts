import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { AiSettingsService } from '../services/ai-settings-service';

export const runtime = Atom.runtime(AiSettingsService.layer.pipe(Layer.provide(CoreLive)));
