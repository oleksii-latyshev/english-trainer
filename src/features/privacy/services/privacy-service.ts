import { Context, Effect, Layer } from 'effect';
import { Ipc, invokeCommand } from '@/core/ipc';
import { KeptRecordingsSchema, SpeechRetentionSchema } from '../schemas';
import type { PrivacyFailure, Retention } from '../types';

type PrivacyServiceShape = {
  readonly retention: Effect.Effect<Retention, PrivacyFailure>;
  readonly setKeepRawAudio: (keepsAudio: boolean) => Effect.Effect<void, PrivacyFailure>;
  readonly deleteKeptRecordings: Effect.Effect<void, PrivacyFailure>;
};

export class PrivacyService extends Context.Service<PrivacyService, PrivacyServiceShape>()(
  'features/privacy/PrivacyService',
) {
  static readonly layer = Layer.effect(
    PrivacyService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        retention: Effect.all({
          settings: invokeCommand(ipc, 'get_speech_settings', SpeechRetentionSchema),
          kept: invokeCommand(ipc, 'get_kept_recordings', KeptRecordingsSchema),
        }).pipe(
          Effect.map(({ settings, kept }) => ({ keepsAudio: settings.keep_raw_audio, kept })),
        ),
        setKeepRawAudio: (keepsAudio) =>
          invokeCommand(ipc, 'save_keep_raw_audio', SpeechRetentionSchema, {
            keep_raw_audio: keepsAudio,
          }).pipe(Effect.asVoid),
        deleteKeptRecordings: invokeCommand(
          ipc,
          'delete_kept_recordings',
          KeptRecordingsSchema,
        ).pipe(Effect.asVoid),
      };
    }),
  );
}
