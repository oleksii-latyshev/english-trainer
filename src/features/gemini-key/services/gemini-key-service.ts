import { Context, Effect, Layer } from 'effect';
import {
  type GeminiKeyStatus,
  GeminiKeyStatusSchema,
  Ipc,
  invokeCommand,
  invokeUnitCommand,
} from '@/core/ipc';
import type { GeminiKeyFailure } from '../types';

type GeminiKeyServiceShape = {
  readonly status: Effect.Effect<GeminiKeyStatus, GeminiKeyFailure>;
  readonly save: (key: string) => Effect.Effect<void, GeminiKeyFailure>;
  readonly remove: Effect.Effect<void, GeminiKeyFailure>;
};

export class GeminiKeyService extends Context.Service<GeminiKeyService, GeminiKeyServiceShape>()(
  'features/gemini-key/GeminiKeyService',
) {
  static readonly layer = Layer.effect(
    GeminiKeyService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        status: invokeCommand(ipc, 'get_gemini_key_status', GeminiKeyStatusSchema),
        save: (key) => invokeUnitCommand(ipc, 'save_gemini_api_key', { key }),
        remove: invokeUnitCommand(ipc, 'delete_gemini_api_key'),
      };
    }),
  );
}
