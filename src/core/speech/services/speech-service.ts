import { Context, Effect, Layer, type Stream } from 'effect';
import type { NaturalVoiceId } from '@/core/voice-preference';
import type { NaturalVoiceFailure, SpeakRequest } from '../types';
import { AudioOutput, type AudioOutputError } from './audio-output-service';
import { NaturalVoice } from './natural-voice-service';
import { runSpeech } from './speech-pipeline';
import { SystemVoice } from './system-voice-service';

type PreviewFailure = NaturalVoiceFailure | AudioOutputError;

type SpeechShape = {
  readonly speak: (request: SpeakRequest) => Effect.Effect<void>;
  readonly preview: (
    text: string,
    voiceId: NaturalVoiceId,
    rate: number,
  ) => Effect.Effect<void, PreviewFailure>;
  readonly pause: Effect.Effect<void>;
  readonly resume: Effect.Effect<void>;
  readonly prewarm: Effect.Effect<boolean, NaturalVoiceFailure>;
  readonly systemVoices: Stream.Stream<readonly SpeechSynthesisVoice[]>;
};

export class Speech extends Context.Service<Speech, SpeechShape>()('core/speech/Speech') {
  static readonly layer = Layer.effect(
    Speech,
    Effect.gen(function* () {
      const natural = yield* NaturalVoice;
      const output = yield* AudioOutput;
      const system = yield* SystemVoice;
      return {
        speak: (request) => runSpeech({ natural, output, system }, request),
        preview: (text, voiceId, rate) =>
          Effect.scoped(
            Effect.gen(function* () {
              const session = yield* output.open;
              const wave = yield* natural.synthesize(text, voiceId, rate);
              yield* session.enqueue(wave, 0);
              yield* session.untilIdle;
            }),
          ),
        pause: Effect.all([output.pause, system.pause], { discard: true }),
        resume: Effect.all([output.resume, system.resume], { discard: true }),
        prewarm: natural.prewarm,
        systemVoices: system.voices,
      };
    }),
  );
}
