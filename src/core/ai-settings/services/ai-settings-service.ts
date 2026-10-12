import { Context, Effect, Layer } from 'effect';
import {
  type AiSettings,
  AiSettingsSchema,
  Ipc,
  invokeCommand,
  invokeUnitCommand,
} from '@/core/ipc';
import type { AiSettingsFailure } from '../types';

type AiSettingsServiceShape = {
  readonly get: Effect.Effect<AiSettings, AiSettingsFailure>;
  readonly save: (settings: AiSettings) => Effect.Effect<AiSettings, AiSettingsFailure>;
  readonly prewarm: Effect.Effect<void, AiSettingsFailure>;
};

export class AiSettingsService extends Context.Service<AiSettingsService, AiSettingsServiceShape>()(
  'core/ai-settings/AiSettingsService',
) {
  static readonly layer = Layer.effect(
    AiSettingsService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        get: invokeCommand(ipc, 'get_ai_settings', AiSettingsSchema),
        save: (settings) => invokeCommand(ipc, 'save_ai_settings', AiSettingsSchema, { settings }),
        prewarm: invokeUnitCommand(ipc, 'prewarm_conversation_provider'),
      };
    }),
  );
}
