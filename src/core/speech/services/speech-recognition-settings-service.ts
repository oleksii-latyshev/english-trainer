import { Context, Effect, Layer } from 'effect';
import {
  Ipc,
  IpcBinary,
  invokeBinaryCommand,
  invokeCommand,
  openChannel,
  type SpeechCheckProgress,
  SpeechCheckProgressSchema,
  type SpeechCheckResults,
  SpeechCheckResultsSchema,
  type SpeechCheckStatus,
  SpeechCheckStatusSchema,
  type SpeechModels,
  SpeechModelsSchema,
  type SpeechSettings,
  SpeechSettingsSchema,
} from '@/core/ipc';
import { bytesOf } from '../helpers/blob-bytes';
import type { SpeechRecognitionFailure } from './speech-recognition-service';

type Call<A> = Effect.Effect<A, SpeechRecognitionFailure>;

export type SpeechRecognitionSettingsShape = {
  readonly settings: Call<SpeechSettings>;
  readonly models: Call<SpeechModels>;
  readonly saveModel: (modelFile: string) => Call<SpeechSettings>;
  readonly saveLiveTranscript: (enabled: boolean) => Call<SpeechSettings>;
  readonly speechCheck: Call<SpeechCheckStatus>;
  readonly saveSpeechCheckRecording: (index: number, wav: Blob) => Call<SpeechCheckStatus>;
  readonly deleteSpeechCheckRecordings: Call<SpeechCheckStatus>;
  readonly runSpeechCheck: (
    modelFiles: ReadonlyArray<string>,
    includePrompt: boolean,
    onProgress: (progress: SpeechCheckProgress) => void,
  ) => Call<SpeechCheckResults>;
};

export class SpeechRecognitionSettings extends Context.Service<
  SpeechRecognitionSettings,
  SpeechRecognitionSettingsShape
>()('core/speech/SpeechRecognitionSettings') {
  static readonly layer = Layer.effect(
    SpeechRecognitionSettings,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      const binary = yield* IpcBinary;
      return {
        settings: Effect.suspend(() =>
          invokeCommand(ipc, 'get_speech_settings', SpeechSettingsSchema),
        ),
        models: Effect.suspend(() => invokeCommand(ipc, 'list_speech_models', SpeechModelsSchema)),
        saveModel: (modelFile) =>
          invokeCommand(ipc, 'save_speech_model', SpeechSettingsSchema, { model_file: modelFile }),
        saveLiveTranscript: (enabled) =>
          invokeCommand(ipc, 'save_live_transcript', SpeechSettingsSchema, {
            live_transcript: enabled,
          }),
        speechCheck: Effect.suspend(() =>
          invokeCommand(ipc, 'get_speech_check', SpeechCheckStatusSchema),
        ),
        saveSpeechCheckRecording: (index, wav) =>
          Effect.flatMap(bytesOf(wav), (bytes) =>
            invokeBinaryCommand(
              binary,
              'save_speech_check_recording',
              SpeechCheckStatusSchema,
              bytes,
              { 'x-sentence-index': String(index) },
            ),
          ),
        deleteSpeechCheckRecordings: Effect.suspend(() =>
          invokeCommand(ipc, 'delete_speech_check_recordings', SpeechCheckStatusSchema),
        ),
        runSpeechCheck: (modelFiles, includePrompt, onProgress) =>
          Effect.suspend(() =>
            invokeCommand(ipc, 'run_speech_check', SpeechCheckResultsSchema, {
              model_files: modelFiles,
              include_prompt: includePrompt,
              on_progress: openChannel(SpeechCheckProgressSchema, onProgress),
            }),
          ),
      };
    }),
  );
}
