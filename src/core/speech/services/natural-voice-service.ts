import { Context, Effect, Layer, Schema } from 'effect';
import { Ipc, invokeCommand } from '@/core/ipc';
import type { NaturalVoiceId } from '@/core/voice-preference';
import { WaveAudioSchema } from '../helpers/wave-audio';
import type { NaturalVoiceFailure } from '../types';

export type NaturalVoiceShape = {
  readonly prewarm: Effect.Effect<boolean, NaturalVoiceFailure>;
  readonly synthesize: (
    text: string,
    voiceId: NaturalVoiceId,
    speed: number,
  ) => Effect.Effect<ArrayBuffer, NaturalVoiceFailure>;
};

export class NaturalVoice extends Context.Service<NaturalVoice, NaturalVoiceShape>()(
  'core/speech/NaturalVoice',
) {
  static readonly layer = Layer.effect(
    NaturalVoice,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        prewarm: Effect.suspend(() => invokeCommand(ipc, 'prewarm_natural_voice', Schema.Boolean)),
        synthesize: (text, voiceId, speed) =>
          Effect.suspend(() =>
            invokeCommand(ipc, 'synthesize_natural_voice', WaveAudioSchema, {
              text,
              voice_id: voiceId,
              speed,
            }),
          ),
      };
    }),
  );
}
