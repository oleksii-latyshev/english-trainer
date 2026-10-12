import { Context, Effect, Layer } from 'effect';
import {
  Ipc,
  invokeCommand,
  type NativeLanguageSettings,
  NativeLanguageSettingsSchema,
  type TranslationStatus,
  TranslationStatusSchema,
} from '@/core/ipc';
import type { TranslationSettingsFailure } from '../types';

type TranslationSettingsServiceShape = {
  readonly get: Effect.Effect<NativeLanguageSettings, TranslationSettingsFailure>;
  readonly save: (
    settings: NativeLanguageSettings,
  ) => Effect.Effect<NativeLanguageSettings, TranslationSettingsFailure>;
  readonly status: Effect.Effect<TranslationStatus, TranslationSettingsFailure>;
  readonly prepare: Effect.Effect<TranslationStatus, TranslationSettingsFailure>;
};

export class TranslationSettingsService extends Context.Service<
  TranslationSettingsService,
  TranslationSettingsServiceShape
>()('core/translation-settings/TranslationSettingsService') {
  static readonly layer = Layer.effect(
    TranslationSettingsService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        get: invokeCommand(ipc, 'get_translation_settings', NativeLanguageSettingsSchema),
        save: (settings) =>
          invokeCommand(ipc, 'save_translation_settings', NativeLanguageSettingsSchema, {
            settings,
          }),
        status: invokeCommand(ipc, 'get_translation_status', TranslationStatusSchema),
        prepare: invokeCommand(ipc, 'prepare_translation_languages', TranslationStatusSchema),
      };
    }),
  );
}
