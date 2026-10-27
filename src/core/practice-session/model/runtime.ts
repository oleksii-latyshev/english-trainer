import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { PracticeSessions } from '../services/practice-session-service';

const PracticeSessionLive = PracticeSessions.layer.pipe(Layer.provide(CoreLive));

export const runtime = Atom.runtime(PracticeSessionLive);
