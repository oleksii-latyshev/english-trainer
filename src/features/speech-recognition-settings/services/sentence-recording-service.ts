import { Context, Effect, Layer } from 'effect';
import { ClipRecorder, type MicrophoneError, type RecordedClip } from '@/core/audio';
import { SentenceTooShort } from '../errors';
import { MAX_SENTENCE_MS, MIN_SENTENCE_MS } from '../helpers/sentence-recorder';

type SentenceRecordingShape = {
  readonly record: (
    deviceId: string,
  ) => Effect.Effect<RecordedClip, MicrophoneError | SentenceTooShort>;
};

export class SentenceRecording extends Context.Service<SentenceRecording, SentenceRecordingShape>()(
  'features/speech-recognition-settings/SentenceRecording',
) {
  static readonly layer = Layer.effect(
    SentenceRecording,
    Effect.gen(function* () {
      const recorder = yield* ClipRecorder;
      return {
        record: (deviceId) =>
          Effect.gen(function* () {
            const clip = yield* recorder.record({ deviceId, maxMs: MAX_SENTENCE_MS });
            if (clip.durationMs < MIN_SENTENCE_MS) {
              return yield* new SentenceTooShort({ durationMs: clip.durationMs });
            }
            return clip;
          }),
      };
    }),
  );
}
