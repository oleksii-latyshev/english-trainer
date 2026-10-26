import { Context, Effect, Layer } from 'effect';
import { EvaGrowthSchema, Ipc, invokeCommand } from '@/core/ipc';
import type { EvaGrowthFailure, EvaGrowthSnapshot } from '../types';

type EvaGrowthServiceShape = {
  readonly growth: Effect.Effect<EvaGrowthSnapshot, EvaGrowthFailure>;
};

export class EvaGrowthService extends Context.Service<EvaGrowthService, EvaGrowthServiceShape>()(
  'core/eva-growth/EvaGrowthService',
) {
  static readonly layer = Layer.effect(
    EvaGrowthService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return { growth: invokeCommand(ipc, 'get_eva_growth', EvaGrowthSchema) };
    }),
  );
}
