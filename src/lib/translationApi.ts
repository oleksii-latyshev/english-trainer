import { invoke } from '@tauri-apps/api/core';
import {
  isEnglishWord,
  isSafeTranslationContext,
  isTranslationError,
  isTranslationSettings,
  isTranslationStatus,
  isWordTranslation,
  matchesTranslationWord,
  type TranslationError,
  type TranslationRequest,
  type TranslationSettings,
  type WordTranslation,
} from './translationTypes';

function failure(code: TranslationError['code'], message: string): TranslationError {
  return { code, message };
}

function ipcFailure(error: unknown): TranslationError {
  if (isTranslationError(error)) return error;
  return failure('unavailable', 'The translation service is unavailable. Try again.');
}

async function readCommand<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  guard: (value: unknown) => value is T,
): Promise<T> {
  try {
    const result: unknown = await invoke<unknown>(command, args);
    if (!guard(result))
      throw failure('invalid_output', 'The translation service returned invalid data.');
    return result;
  } catch (error) {
    if (isTranslationError(error)) throw error;
    throw ipcFailure(error);
  }
}

export const getTranslationSettings = () =>
  readCommand('get_translation_settings', undefined, isTranslationSettings);

export function saveTranslationSettings(settings: TranslationSettings) {
  return readCommand('save_translation_settings', { settings }, isTranslationSettings);
}

export const getTranslationStatus = () =>
  readCommand('get_translation_status', undefined, isTranslationStatus);

export const prepareTranslationLanguages = () =>
  readCommand('prepare_translation_languages', undefined, isTranslationStatus);

export function translateWord(request: TranslationRequest): Promise<WordTranslation> {
  if (!isEnglishWord(request.word) || !isSafeTranslationContext(request.context)) {
    return Promise.reject(
      failure('invalid_request', 'Enter one English word with context under 500 characters.'),
    );
  }
  return readCommand(
    'translate_word',
    { request },
    (value): value is WordTranslation =>
      isWordTranslation(value) && matchesTranslationWord(value.word, request.word),
  );
}
