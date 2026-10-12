import { Clock, Context, Effect, Layer } from 'effect';
import { ApiUsageOverviewSchema, Ipc, invokeCommand } from '@/core/ipc';
import type { ApiUsageFailure, ApiUsageSnapshot } from '../types';

type ApiUsageServiceShape = {
  readonly snapshot: Effect.Effect<ApiUsageSnapshot, ApiUsageFailure>;
};

export class ApiUsageService extends Context.Service<ApiUsageService, ApiUsageServiceShape>()(
  'features/api-usage/ApiUsageService',
) {
  static readonly layer = Layer.effect(
    ApiUsageService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        snapshot: Effect.gen(function* () {
          const usage = yield* invokeCommand(ipc, 'get_api_usage', ApiUsageOverviewSchema);
          const loadedAtMs = yield* Clock.currentTimeMillis;
          return { usage, loadedAtMs };
        }),
      };
    }),
  );
}
