import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { AnswerHelpService } from '../services/answer-help-service';

export const runtime = Atom.runtime(AnswerHelpService.layer.pipe(Layer.provide(CoreLive)));
