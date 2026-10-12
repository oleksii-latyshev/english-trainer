import { Context, Effect, Layer, Schema } from 'effect';
import { Ipc, invokeCommand } from '@/core/ipc';
import type { NaturalVoiceId } from '@/core/voice-preference';
import { WaveAudioSchema } from '../helpers/wave-audio';
import { VoicePlaybackError, type VoicePreviewFailure } from '../types';

type VoicePreviewServiceShape = {
  readonly prewarm: Effect.Effect<boolean, VoicePreviewFailure>;
  readonly synthesize: (
    text: string,
    voiceId: NaturalVoiceId,
    speed: number,
  ) => Effect.Effect<ArrayBuffer, VoicePreviewFailure>;
  readonly play: (audio: ArrayBuffer) => Effect.Effect<void, VoicePreviewFailure>;
};

function openPlayer(audio: ArrayBuffer) {
  const url = URL.createObjectURL(new Blob([audio], { type: 'audio/wav' }));
  return { url, element: new Audio(url) };
}

type Player = ReturnType<typeof openPlayer>;

function releasePlayer({ url, element }: Player) {
  element.onended = null;
  element.onerror = null;
  element.pause();
  element.removeAttribute('src');
  element.load();
  URL.revokeObjectURL(url);
}

function playUntilEnded({ element }: Player) {
  return Effect.callback<void, VoicePlaybackError>((resume) => {
    element.onended = () => resume(Effect.void);
    element.onerror = () => resume(Effect.fail(new VoicePlaybackError()));
    element.play().catch(() => resume(Effect.fail(new VoicePlaybackError())));
  });
}

function playWave(audio: ArrayBuffer) {
  return Effect.acquireUseRelease(
    Effect.sync(() => openPlayer(audio)),
    playUntilEnded,
    (player) => Effect.sync(() => releasePlayer(player)),
  );
}

export class VoicePreviewService extends Context.Service<
  VoicePreviewService,
  VoicePreviewServiceShape
>()('features/voice-settings/VoicePreviewService') {
  static readonly layer = Layer.effect(
    VoicePreviewService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        prewarm: invokeCommand(ipc, 'prewarm_natural_voice', Schema.Boolean),
        synthesize: (text, voiceId, speed) =>
          invokeCommand(ipc, 'synthesize_natural_voice', WaveAudioSchema, {
            text,
            voice_id: voiceId,
            speed,
          }),
        play: playWave,
      };
    }),
  );
}
