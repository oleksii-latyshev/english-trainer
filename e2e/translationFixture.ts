import type { Page } from '@playwright/test';
import type {
  TranslationLanguage,
  TranslationSettings,
  TranslationStatus,
  WordTranslation,
} from '../src/lib/translationTypes';

declare global {
  interface Window {
    __ET_TRANSLATION_DONE__: number;
  }
}

export type TranslationFixtureOptions = {
  nativeLanguage?: TranslationLanguage;
  needsDownload?: boolean;
  failNextTranslation?: boolean;
  delayedWord?: string;
  statusError?: boolean;
  failNextExplanation?: boolean;
};

/** macOS translation is the IPC edge; selection and panel behavior use the real React UI. */
export async function installTranslationFixture(
  page: Page,
  options: TranslationFixtureOptions = {},
): Promise<void> {
  await page.addInitScript((seed: TranslationFixtureOptions) => {
    const original = window.__TAURI_INTERNALS__.invoke;
    const languages = [
      'ru',
      'uk',
      'de',
      'fr',
      'es',
      'it',
      'pt',
      'ja',
      'ko',
      'zh-Hans',
      'ar',
    ] as const;
    const stored = window.localStorage.getItem('e2e_native_language');
    let nativeLanguage: TranslationLanguage =
      languages.find((code) => code === stored) ?? seed.nativeLanguage ?? 'ru';
    window.__ET_TRANSLATION_DONE__ = 0;
    let needsDownload = seed.needsDownload ?? false;
    let failNext = seed.failNextTranslation ?? false;
    let failExplanation = seed.failNextExplanation ?? false;
    function stringField(value: unknown, field: string): string {
      if (typeof value !== 'object' || value === null)
        throw new Error('Invalid translation request.');
      const text: unknown = Reflect.get(value, field);
      if (typeof text !== 'string') throw new Error('Invalid translation request.');
      return text;
    }
    const status = (): TranslationStatus => ({
      native_language: nativeLanguage,
      status: needsDownload ? 'download_required' : 'installed',
      message: needsDownload
        ? 'Prepare languages on this Mac, then retry.'
        : 'Translation languages are ready on this Mac.',
    });
    function save(args: Record<string, unknown>): TranslationSettings {
      const saved = stringField(args.settings, 'native_language');
      const language = languages.find((code) => code === saved);
      if (!language) throw new Error('Invalid native language fixture request.');
      nativeLanguage = language;
      window.localStorage.setItem('e2e_native_language', nativeLanguage);
      return { native_language: nativeLanguage };
    }
    async function lookup(args: Record<string, unknown>): Promise<WordTranslation> {
      if (needsDownload)
        throw { code: 'download_required', message: 'Prepare languages on this Mac, then retry.' };
      if (failNext) {
        failNext = false;
        throw { code: 'process_failed', message: 'Translation could not finish. Retry this word.' };
      }
      const word = stringField(args.request, 'word');
      if (word === seed.delayedWord)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
      window.__ET_TRANSLATION_DONE__ += 1;
      const missingExplanation = failExplanation;
      failExplanation = false;
      return result(word, missingExplanation);
    }
    function result(word: string, missingExplanation: boolean): WordTranslation {
      return {
        word,
        native_language: nativeLanguage,
        translation: nativeLanguage === 'ru' ? `Перевод: ${word}` : `Meaning: ${word}`,
        english_explanation: missingExplanation ? null : `A simple English explanation of ${word}.`,
        explanation_error: missingExplanation
          ? 'Apple could not explain this word. Retry for an English explanation.'
          : null,
      };
    }
    const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
      get_speech_settings: () => ({
        model_file: '',
        keep_raw_audio: false,
        live_transcript: false,
      }),
      get_speech_engine_status: () => ({
        server: 'not_running',
        failure: null,
        is_live_transcript_available: false,
      }),
      list_speech_models: () => ({ models: [], override_path: null }),
      get_speech_check: () => ({ sentences: [], results: { runs: [] } }),
      get_glossary: () => [],
      get_personal_profile: () => ({ role: '', stack: '', interests: '', goals: '' }),
      get_kept_recordings: () => ({ count: 0, size_bytes: 0 }),
      get_setup_diagnostics: () => {
        const missing = {
          status: 'missing',
          path: null,
          message: 'Not installed in browser tests.',
        };
        return {
          whisper_cli: missing,
          whisper_model: missing,
          whisper_server: missing,
          agy_cli: missing,
          database_path: 'browser-fixture',
        };
      },
      get_api_usage: () => ({
        day: '2026-10-09',
        gemini: { models: [], last_limit: null, resets_at_ms: 1_800_000_000_000 },
        antigravity: { requests_today: 0, last_quota_error: null },
      }),
      get_translation_settings: () => ({ native_language: nativeLanguage }),
      save_translation_settings: save,
      get_translation_status: () => {
        if (seed.statusError)
          throw {
            code: 'unavailable',
            message: 'Translation availability could not be checked. Retry.',
          };
        return status();
      },
      prepare_translation_languages: () => {
        needsDownload = false;
        return status();
      },
      translate_word: lookup,
    };
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      const handler = handlers[command];
      if (!handler) return original(command, args);
      window.__ET_HARNESS__.calls.push({ command, args });
      return handler(args);
    };
  }, options);
}
