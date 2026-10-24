import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { CoachingNoteService } from '../services/coaching-note-service';

export const runtime = Atom.runtime(CoachingNoteService.layer.pipe(Layer.provide(CoreLive)));
