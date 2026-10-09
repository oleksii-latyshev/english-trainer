// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  isKeptRecordings,
  isSpeechCheckStatus,
  isSpeechEngineStatus,
  isSpeechModels,
  isSpeechSettings,
  speechErrorMessage,
} from './speechTypes';

const recording = {
  index: 1,
  reference: 'I tried the Gemini API',
  transcript: 'I tried the Jimini IP',
  time_ms: 900,
  terms_found: 0,
  terms_total: 1,
  word_error_rate: 0.4,
};
const run = {
  model_file: 'ggml-base.en.bin',
  uses_prompt: false,
  measured_at_ms: 5,
  terms_found: 0,
  terms_total: 1,
  term_accuracy: 0,
  word_error_rate: 0.4,
  median_ms: 900,
  max_ms: 900,
  recordings: [recording],
};
const status = {
  sentences: [{ index: 1, text: 'I tried the Gemini API', is_recorded: true }],
  results: { runs: [run] },
};

describe('speech payloads', () => {
  it('accepts what Rust sends', () => {
    expect(isSpeechCheckStatus(status)).toBe(true);
    expect(
      isSpeechCheckStatus({ ...status, results: { runs: [{ ...run, term_accuracy: null }] } }),
    ).toBe(true);
    expect(
      isSpeechSettings({
        model_file: 'ggml-base.en.bin',
        keep_raw_audio: false,
        live_transcript: true,
      }),
    ).toBe(true);
    expect(
      isSpeechEngineStatus({ server: 'ready', failure: null, is_live_transcript_available: true }),
    ).toBe(true);
    expect(isSpeechModels({ models: [{ file: 'a', size_bytes: 3 }], override_path: null })).toBe(
      true,
    );
    expect(isKeptRecordings({ count: 2, size_bytes: 10 })).toBe(true);
  });

  it('rejects malformed shapes', () => {
    expect(isSpeechCheckStatus({ ...status, sentences: [{ index: 1 }] })).toBe(false);
    expect(isSpeechCheckStatus({ ...status, results: { runs: [{ ...run, median_ms: -1 }] } })).toBe(
      false,
    );
    expect(isSpeechSettings({ model_file: 'x' })).toBe(false);
    expect(isSpeechSettings({ model_file: 'x', keep_raw_audio: false })).toBe(false);
    expect(
      isSpeechEngineStatus({
        server: 'starting',
        failure: null,
        is_live_transcript_available: true,
      }),
    ).toBe(false);
    expect(isSpeechModels({ models: [], override_path: 5 })).toBe(false);
    expect(isKeptRecordings(null)).toBe(false);
  });

  it('shows Rust error messages and a fallback for anything else', () => {
    expect(speechErrorMessage({ code: 'busy', message: 'Wait.' }, 'Fallback')).toBe('Wait.');
    expect(speechErrorMessage({ code: 'database_error', message: 'DB.' }, 'Fallback')).toBe('DB.');
    expect(speechErrorMessage(new Error('x'), 'Fallback')).toBe('Fallback');
  });
});
