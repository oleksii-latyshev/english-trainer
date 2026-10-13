import type { Page } from '@playwright/test';
import type { SpeechCheckStatus, SpeechModels, SpeechSettings } from '@/core/ipc';

export type SpeechSettingsOptions = {
  settings?: SpeechSettings;
  models?: SpeechModels;
  check?: SpeechCheckStatus;
  failNextModelSave?: boolean;
};

const MEBIBYTE = 1024 * 1024;

export const SPEECH_FIXTURE: Required<Omit<SpeechSettingsOptions, 'failNextModelSave'>> = {
  settings: { model_file: 'ggml-small.en.bin', keep_raw_audio: false, live_transcript: true },
  models: {
    models: [
      { file: 'ggml-base.en.bin', size_bytes: 148 * MEBIBYTE },
      { file: 'ggml-small.en.bin', size_bytes: 488 * MEBIBYTE },
    ],
    override_path: null,
  },
  check: {
    sentences: [
      { index: 1, text: 'I deployed the new service on Friday.', is_recorded: true },
      { index: 2, text: 'The pull request needs one more review.', is_recorded: false },
    ],
    results: {
      runs: [
        {
          model_file: 'ggml-small.en.bin',
          uses_prompt: false,
          measured_at_ms: 1,
          terms_found: 4,
          terms_total: 4,
          term_accuracy: 1,
          word_error_rate: 0.03,
          median_ms: 800,
          max_ms: 900,
          recordings: [
            {
              index: 1,
              reference: 'I deployed the new service on Friday.',
              transcript: 'I deployed the new service on Friday.',
              time_ms: 800,
              terms_found: 4,
              terms_total: 4,
              word_error_rate: 0,
            },
          ],
        },
        {
          model_file: 'ggml-base.en.bin',
          uses_prompt: false,
          measured_at_ms: 2,
          terms_found: 3,
          terms_total: 4,
          term_accuracy: 0.75,
          word_error_rate: 0.11,
          median_ms: 300,
          max_ms: 400,
          recordings: [],
        },
      ],
    },
  },
};

export async function installSpeechSettings(page: Page, options: SpeechSettingsOptions = {}) {
  await page.addInitScript(
    (seed) => {
      const internals = window.__TAURI_INTERNALS__;
      const original = internals.invoke;
      let settings = seed.settings;
      let failNextModelSave = seed.failNextModelSave ?? false;
      function record(command: string, args: Record<string, unknown>) {
        window.__ET_HARNESS__.calls.push({ command, args });
      }
      function saveModel(args: Record<string, unknown>) {
        if (failNextModelSave) {
          failNextModelSave = false;
          throw { code: 'invalid_request', message: 'That model is not installed.' };
        }
        settings = { ...settings, model_file: String(args.model_file) };
        return settings;
      }
      function saveLiveTranscript(args: Record<string, unknown>) {
        settings = { ...settings, live_transcript: args.live_transcript === true };
        return settings;
      }
      const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
        get_speech_settings: () => settings,
        list_speech_models: () => seed.models,
        get_speech_check: () => seed.check,
        get_speech_engine_status: () => ({
          server: 'ready',
          failure: null,
          is_live_transcript_available: true,
        }),
        save_speech_model: saveModel,
        save_live_transcript: saveLiveTranscript,
      };
      internals.invoke = async (command, args = {}) => {
        const handler = handlers[command];
        if (!handler) return original(command, args);
        record(command, args);
        return handler(args);
      };
    },
    { ...SPEECH_FIXTURE, ...options },
  );
}
