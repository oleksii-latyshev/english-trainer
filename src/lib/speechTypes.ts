import { Channel, invoke } from '@tauri-apps/api/core';
import { isRecord } from './localPreference';
import { isProviderError, isTranscriptionError } from './types';

/** Mirrors `SpeechSettings` in Rust `audio/models.rs`. */
export type SpeechSettings = { model_file: string; keep_raw_audio: boolean };

/** Mirrors `SpeechModels` in Rust `audio/commands.rs`. */
export type SpeechModel = { file: string; size_bytes: number };
export type SpeechModels = { models: SpeechModel[]; override_path: string | null };

/** Mirrors `KeptRecordings` in Rust `audio/kept.rs`. */
export type KeptRecordings = { count: number; size_bytes: number };

/** Mirrors the speech check types in Rust `audio/speech_check.rs`. */
export type SentenceStatus = { index: number; text: string; is_recorded: boolean };

export type RecordingResult = {
  index: number;
  reference: string;
  transcript: string;
  time_ms: number;
  terms_found: number;
  terms_total: number;
  word_error_rate: number;
};

export type ModelRun = {
  model_file: string;
  uses_prompt: boolean;
  measured_at_ms: number;
  terms_found: number;
  terms_total: number;
  term_accuracy: number | null;
  word_error_rate: number;
  median_ms: number;
  max_ms: number;
  recordings: RecordingResult[];
};

export type SpeechCheckResults = { runs: ModelRun[] };
export type SpeechCheckStatus = { sentences: SentenceStatus[]; results: SpeechCheckResults };

/** `model_file` is empty on the final report. */
export type SpeechCheckProgress = {
  model_file: string;
  uses_prompt: boolean;
  done: number;
  total: number;
};

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

export function isSpeechSettings(value: unknown): value is SpeechSettings {
  return (
    isRecord(value) &&
    typeof value.model_file === 'string' &&
    typeof value.keep_raw_audio === 'boolean'
  );
}

function isSpeechModel(value: unknown): value is SpeechModel {
  return isRecord(value) && typeof value.file === 'string' && isCount(value.size_bytes);
}

export function isSpeechModels(value: unknown): value is SpeechModels {
  return (
    isRecord(value) &&
    isArrayOf(value.models, isSpeechModel) &&
    (value.override_path === null || typeof value.override_path === 'string')
  );
}

export function isKeptRecordings(value: unknown): value is KeptRecordings {
  return isRecord(value) && isCount(value.count) && isCount(value.size_bytes);
}

function isSentenceStatus(value: unknown): value is SentenceStatus {
  return (
    isRecord(value) &&
    isCount(value.index) &&
    typeof value.text === 'string' &&
    typeof value.is_recorded === 'boolean'
  );
}

function isRecordingResult(value: unknown): value is RecordingResult {
  return (
    isRecord(value) &&
    isCount(value.index) &&
    typeof value.reference === 'string' &&
    typeof value.transcript === 'string' &&
    isCount(value.time_ms) &&
    isCount(value.terms_found) &&
    isCount(value.terms_total) &&
    isRatio(value.word_error_rate)
  );
}

function isModelRun(value: unknown): value is ModelRun {
  return (
    isRecord(value) &&
    typeof value.model_file === 'string' &&
    typeof value.uses_prompt === 'boolean' &&
    isCount(value.measured_at_ms) &&
    isCount(value.terms_found) &&
    isCount(value.terms_total) &&
    (value.term_accuracy === null || isRatio(value.term_accuracy)) &&
    isRatio(value.word_error_rate) &&
    isCount(value.median_ms) &&
    isCount(value.max_ms) &&
    isArrayOf(value.recordings, isRecordingResult)
  );
}

export function isSpeechCheckResults(value: unknown): value is SpeechCheckResults {
  return isRecord(value) && isArrayOf(value.runs, isModelRun);
}

export function isSpeechCheckStatus(value: unknown): value is SpeechCheckStatus {
  return (
    isRecord(value) &&
    isArrayOf(value.sentences, isSentenceStatus) &&
    isSpeechCheckResults(value.results)
  );
}

export function isSpeechCheckProgress(value: unknown): value is SpeechCheckProgress {
  return (
    isRecord(value) &&
    typeof value.model_file === 'string' &&
    typeof value.uses_prompt === 'boolean' &&
    isCount(value.done) &&
    isCount(value.total)
  );
}

function isStringList(value: unknown): value is string[] {
  return isArrayOf(value, (item): item is string => typeof item === 'string');
}

/** What to tell the learner about a failed command: Rust's message, or a plain fallback. */
export function speechErrorMessage(cause: unknown, fallback: string): string {
  if (isTranscriptionError(cause) || isProviderError(cause)) return cause.message;
  return fallback;
}

async function call<T>(
  command: string,
  guard: (value: unknown) => value is T,
  args?: Record<string, unknown>,
): Promise<T> {
  const result: unknown = await invoke<unknown>(command, args);
  if (!guard(result)) throw new Error(`Unexpected ${command} response from backend.`);
  return result;
}

export const getSpeechSettings = () => call('get_speech_settings', isSpeechSettings);
export const listSpeechModels = () => call('list_speech_models', isSpeechModels);
export const saveSpeechModel = (modelFile: string) =>
  call('save_speech_model', isSpeechSettings, { model_file: modelFile });
export const saveKeepRawAudio = (keepRawAudio: boolean) =>
  call('save_keep_raw_audio', isSpeechSettings, { keep_raw_audio: keepRawAudio });
export const getGlossary = () => call('get_glossary', isStringList);
export const saveGlossary = (terms: string[]) => call('save_glossary', isStringList, { terms });
export const getKeptRecordings = () => call('get_kept_recordings', isKeptRecordings);
export const deleteKeptRecordings = () => call('delete_kept_recordings', isKeptRecordings);
export const getSpeechCheck = () => call('get_speech_check', isSpeechCheckStatus);
export const deleteSpeechCheckRecordings = () =>
  call('delete_speech_check_recordings', isSpeechCheckStatus);

/** Stores the reading of one sentence (1-based `index`); the WAV is the raw request body. */
export async function saveSpeechCheckRecording(
  index: number,
  wav: Blob,
): Promise<SpeechCheckStatus> {
  const bytes = new Uint8Array(await wav.arrayBuffer());
  const result: unknown = await invoke<unknown>('save_speech_check_recording', bytes, {
    headers: { 'x-sentence-index': String(index) },
  });
  if (!isSpeechCheckStatus(result)) throw new Error('Unexpected recording response from backend.');
  return result;
}

/** Measures the models on the recordings; `onProgress` hears about each recording before it runs. */
export function runSpeechCheck(
  modelFiles: string[],
  includePrompt: boolean,
  onProgress: (progress: SpeechCheckProgress) => void,
): Promise<SpeechCheckResults> {
  const channel = new Channel<unknown>();
  channel.onmessage = (message) => {
    if (isSpeechCheckProgress(message)) onProgress(message);
  };
  return call('run_speech_check', isSpeechCheckResults, {
    model_files: modelFiles,
    include_prompt: includePrompt,
    on_progress: channel,
  });
}
