import { Effect } from 'effect';
import { IpcError, type SpeechCheckProgress } from '@/core/ipc';
import { SpeechRecognition, SpeechRecognitionSettings } from '@/core/speech';
import { settleSpeech } from './settle-speech';

export type {
  ModelRun,
  RecordingResult,
  SentenceStatus,
  SpeechCheckProgress,
  SpeechCheckResults,
  SpeechCheckStatus,
  SpeechEngineStatus,
  SpeechModel,
  SpeechModels,
  SpeechSettings,
} from '@/core/ipc';

type SettingsClient = SpeechRecognitionSettings['Service'];

export function speechErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof IpcError ? cause.message : fallback;
}

function withSettings<A, E>(use: (client: SettingsClient) => Effect.Effect<A, E>) {
  return settleSpeech(Effect.flatMap(SpeechRecognitionSettings, use));
}

export function getSpeechSettings() {
  return withSettings((client) => client.settings);
}

export function listSpeechModels() {
  return withSettings((client) => client.models);
}

export function saveSpeechModel(modelFile: string) {
  return withSettings((client) => client.saveModel(modelFile));
}

export function saveLiveTranscript(liveTranscript: boolean) {
  return withSettings((client) => client.saveLiveTranscript(liveTranscript));
}

export function getSpeechCheck() {
  return withSettings((client) => client.speechCheck);
}

export function deleteSpeechCheckRecordings() {
  return withSettings((client) => client.deleteSpeechCheckRecordings);
}

export function saveSpeechCheckRecording(index: number, wav: Blob) {
  return withSettings((client) => client.saveSpeechCheckRecording(index, wav));
}

export function runSpeechCheck(
  modelFiles: string[],
  includePrompt: boolean,
  onProgress: (progress: SpeechCheckProgress) => void,
) {
  return withSettings((client) => client.runSpeechCheck(modelFiles, includePrompt, onProgress));
}

export function getSpeechEngineStatus() {
  return settleSpeech(Effect.flatMap(SpeechRecognition, (recognition) => recognition.engineStatus));
}

export function warmSpeechEngine() {
  return settleSpeech(Effect.flatMap(SpeechRecognition, (recognition) => recognition.warm));
}
