import { Layer } from 'effect';
import { AnswerCaptureLive } from '@/core/answer-capture';
import { audioAtomContext } from '@/core/audio';
import { CoreLive } from '@/core/runtime';
import { PracticeTurns } from '../services/practice-turn-service';

export const PracticeTurnLive = Layer.mergeAll(
  PracticeTurns.layer.pipe(Layer.provide(CoreLive)),
  AnswerCaptureLive,
);

export const turnRuntime = audioAtomContext(PracticeTurnLive);
