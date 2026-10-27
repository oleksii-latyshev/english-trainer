import { Context, Duration, Effect, Layer, Stream } from 'effect';
import {
  ClipRecorder,
  type MicrophoneError,
  type RecordedClip,
  readPreferredMicrophone,
} from '@/core/audio';
import { IpcError, isTauriRuntime } from '@/core/ipc';
import {
  createSpeechGate,
  liveTranscript,
  SpeechRecognition,
  type SpeechRecognitionFailure,
  type TranscribedAnswer,
} from '@/core/speech';

const MAX_ANSWER_MS = 120_000;
const LEVEL_SAMPLE_INTERVAL = Duration.millis(100);
const DESKTOP_ONLY_MESSAGE = 'Open the desktop app with bun run dev to use local transcription.';

type AnswerCaptureShape = {
  readonly record: (
    onLiveText: (text: string) => void,
  ) => Effect.Effect<RecordedClip, MicrophoneError>;
  readonly transcribe: (wav: Blob) => Effect.Effect<TranscribedAnswer, SpeechRecognitionFailure>;
};

export class AnswerCapture extends Context.Service<AnswerCapture, AnswerCaptureShape>()(
  'features/spoken-review/AnswerCapture',
) {
  static readonly layer = Layer.effect(
    AnswerCapture,
    Effect.gen(function* () {
      const recorder = yield* ClipRecorder;
      const recognition = yield* SpeechRecognition;
      return {
        record: (onLiveText) =>
          recorder.record({
            deviceId: readPreferredMicrophone(),
            maxMs: MAX_ANSWER_MS,
            whileRecording: (capture) => {
              const gate = createSpeechGate();
              const sampling = Effect.forever(
                Effect.sleep(LEVEL_SAMPLE_INTERVAL).pipe(
                  Effect.andThen(capture.level),
                  Effect.flatMap((level) => Effect.sync(() => gate.sample(level))),
                ),
              );
              const liveText = liveTranscript({
                snapshot: capture.snapshot(),
                hasHeardSpeech: Effect.sync(gate.hasHeardSpeech),
              }).pipe(
                Stream.runForEach((text) => Effect.sync(() => onLiveText(text))),
                Effect.provideService(SpeechRecognition, recognition),
              );
              return Effect.all([sampling, liveText], { concurrency: 'unbounded', discard: true });
            },
          }),
        transcribe: (wav) =>
          isTauriRuntime()
            ? recognition.transcribe(wav)
            : Effect.fail(new IpcError({ code: 'engine_missing', message: DESKTOP_ONLY_MESSAGE })),
      };
    }),
  );
}
