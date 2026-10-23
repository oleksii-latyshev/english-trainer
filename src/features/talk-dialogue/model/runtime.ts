import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { DialogueService } from '../services/dialogue-service';

export const runtime = Atom.runtime(DialogueService.layer.pipe(Layer.provide(CoreLive)));
