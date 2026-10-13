import { Context, Effect, Layer } from 'effect';
import { Ipc, invokeCommand, SpeakingActivitySchema } from '@/core/ipc';
import type { SpeakingActivityFailure, SpeakingActivitySnapshot } from '../types';

type SpeakingActivityServiceShape = {
  readonly activity: Effect.Effect<SpeakingActivitySnapshot, SpeakingActivityFailure>;
};

export class SpeakingActivityService extends Context.Service<
  SpeakingActivityService,
  SpeakingActivityServiceShape
>()('features/speaking-activity/SpeakingActivityService') {
  static readonly layer = Layer.effect(
    SpeakingActivityService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        activity: invokeCommand(ipc, 'get_speaking_activity', SpeakingActivitySchema),
      };
    }),
  );
}
