import { Context, Duration, Effect, Layer, Schema } from 'effect';
import {
  Ipc,
  IpcBinary,
  type IpcDecodeError,
  IpcError,
  invokeBinaryCommand,
  invokeCommand,
  invokeUnitCommand,
  PartialTranscriptSchema,
  type SpeechEngineStatus,
  SpeechEngineStatusSchema,
  TranscriptSchema,
} from '@/core/ipc';
import { bytesOf } from '../helpers/blob-bytes';

export type SpeechRecognitionFailure = IpcError | IpcDecodeError;

export type TranscribedAnswer = { readonly text: string; readonly sttMs: number };

export type RescueTurn = { readonly sessionId: number; readonly sequence: number };

const NO_RESCUE_SPEECH_MESSAGE = 'No speech was recognized. Keep speaking and try Stuck again.';

export type SpeechRecognitionShape = {
  readonly transcribe: (wav: Blob) => Effect.Effect<TranscribedAnswer, SpeechRecognitionFailure>;
  readonly transcribePartial: (wav: Blob) => Effect.Effect<string | null, SpeechRecognitionFailure>;
  readonly transcribeRescue: (
    wav: Blob,
    turn: RescueTurn,
  ) => Effect.Effect<string, SpeechRecognitionFailure>;
  readonly engineStatus: Effect.Effect<SpeechEngineStatus, SpeechRecognitionFailure>;
  readonly warm: Effect.Effect<void, SpeechRecognitionFailure>;
};

const RESCUE_TEXT_TAIL_CHARS = 1500;

export class SpeechRecognition extends Context.Service<SpeechRecognition, SpeechRecognitionShape>()(
  'core/speech/SpeechRecognition',
) {
  static readonly layer = Layer.effect(
    SpeechRecognition,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      const binary = yield* IpcBinary;
      return {
        transcribe: (wav) =>
          Effect.gen(function* () {
            const bytes = yield* bytesOf(wav);
            const [elapsed, transcript] = yield* Effect.timed(
              invokeBinaryCommand(binary, 'transcribe_audio', TranscriptSchema, bytes),
            );
            return { text: transcript.text, sttMs: Duration.toMillis(elapsed) };
          }),
        transcribePartial: (wav) =>
          Effect.flatMap(bytesOf(wav), (bytes) =>
            invokeBinaryCommand(binary, 'transcribe_partial', PartialTranscriptSchema, bytes),
          ),
        transcribeRescue: (wav, turn) =>
          Effect.gen(function* () {
            const bytes = yield* bytesOf(wav);
            const text = yield* invokeBinaryCommand(
              binary,
              'transcribe_rescue',
              Schema.String,
              bytes,
              {
                'x-session-id': String(turn.sessionId),
                'x-answer-sequence': String(turn.sequence),
              },
            );
            if (!text.trim()) {
              return yield* new IpcError({ code: 'no_speech', message: NO_RESCUE_SPEECH_MESSAGE });
            }
            return text.slice(-RESCUE_TEXT_TAIL_CHARS);
          }),
        engineStatus: Effect.suspend(() =>
          invokeCommand(ipc, 'get_speech_engine_status', SpeechEngineStatusSchema),
        ),
        warm: Effect.suspend(() => invokeUnitCommand(ipc, 'warm_speech_engine')),
      };
    }),
  );
}
