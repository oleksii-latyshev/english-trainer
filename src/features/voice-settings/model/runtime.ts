import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { VoicePreviewService } from '../services/voice-preview-service';

export const runtime = Atom.runtime(VoicePreviewService.layer.pipe(Layer.provide(CoreLive)));
