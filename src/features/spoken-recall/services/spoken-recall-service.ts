import { Context, Effect, Layer } from 'effect';
import {
  DailyRecallPlanSchema,
  Ipc,
  IpcDecodeError,
  invokeCommand,
  SpokenRecallResultSchema,
} from '@/core/ipc';
import type { DailyRecallPlan, SpokenRecallFailure, SpokenRecallResult } from '../types';

type SpokenRecallServiceShape = {
  readonly plan: (sessionId: number) => Effect.Effect<DailyRecallPlan, SpokenRecallFailure>;
  readonly submit: (
    sessionId: number,
    phraseId: number,
    transcript: string,
  ) => Effect.Effect<SpokenRecallResult, SpokenRecallFailure>;
};

export class SpokenRecallService extends Context.Service<
  SpokenRecallService,
  SpokenRecallServiceShape
>()('features/spoken-recall/SpokenRecallService') {
  static readonly layer = Layer.effect(
    SpokenRecallService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        plan: (sessionId) =>
          invokeCommand(ipc, 'get_daily_recall_plan', DailyRecallPlanSchema, { sessionId }),
        submit: (sessionId, phraseId, transcript) =>
          invokeCommand(ipc, 'submit_daily_recall', SpokenRecallResultSchema, {
            sessionId,
            phraseId,
            transcript,
          }).pipe(
            Effect.filterOrFail(
              (result) => result.phrase_id === phraseId,
              () =>
                new IpcDecodeError({
                  command: 'submit_daily_recall',
                  cause: `expected phrase ${phraseId}`,
                }),
            ),
          ),
      };
    }),
  );
}
