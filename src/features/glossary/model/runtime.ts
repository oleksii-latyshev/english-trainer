import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { GlossaryService } from '../services/glossary-service';

export const runtime = Atom.runtime(GlossaryService.layer.pipe(Layer.provide(CoreLive)));
