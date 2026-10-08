// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { ModelRun, SentenceStatus } from '@/lib/speechTypes';
import {
  formatPercent,
  formatSize,
  glossarySummary,
  modelName,
  modelOptionLabel,
  nextSentenceIndex,
  progressText,
  startingSentenceIndex,
} from './speechCheck';

const run: ModelRun = {
  model_file: 'ggml-small.en.bin',
  uses_prompt: false,
  measured_at_ms: 1,
  terms_found: 8,
  terms_total: 10,
  term_accuracy: 0.8,
  word_error_rate: 0.123,
  median_ms: 1234,
  max_ms: 2000,
  recordings: [],
};

const sentences = (recorded: boolean[]): SentenceStatus[] =>
  recorded.map((is_recorded, position) => ({ index: position + 1, text: 's', is_recorded }));

describe('formatting', () => {
  it('shows ratios as percent and sizes in MB or GB', () => {
    expect(formatPercent(0.725)).toBe('73%');
    expect(formatPercent(null)).toBe('no terms');
    expect(formatSize(148 * 1024 * 1024)).toBe('148 MB');
    expect(formatSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
    expect(modelName('ggml-large-v3-turbo-q5_0.bin')).toBe('large-v3-turbo-q5_0');
  });

  it('describes a model with or without a measurement', () => {
    const model = { file: 'ggml-small.en.bin', size_bytes: 466 * 1024 * 1024 };
    expect(modelOptionLabel(model, undefined)).toBe('small.en · 466 MB · not measured');
    expect(modelOptionLabel(model, run)).toBe('small.en · 466 MB · terms 80% · errors 12% · 1.2 s');
  });

  it('reports progress and summarises the glossary', () => {
    const progress = { model_file: 'ggml-base.en.bin', uses_prompt: true, done: 3, total: 24 };
    expect(progressText(progress)).toBe(
      'base.en with the glossary prompt: 3 of 24 recordings done',
    );
    expect(progressText({ ...progress, model_file: '' })).toBe('Saving the measurements…');
    expect(glossarySummary(['a', 'b'])).toBe('a, b');
    expect(glossarySummary(['a', 'b', 'c'], 2)).toBe('a, b…');
    expect(glossarySummary([])).toBe('No words yet.');
  });
});

describe('sentence order', () => {
  it('starts at the first unrecorded sentence', () => {
    expect(startingSentenceIndex(sentences([true, true, false, false]))).toBe(3);
    expect(startingSentenceIndex(sentences([true, true]))).toBe(1);
  });

  it('moves to the next sentence still to record, else the next one, else stops', () => {
    expect(nextSentenceIndex(sentences([false, true, false, true]), 1)).toBe(3);
    expect(nextSentenceIndex(sentences([false, true, true]), 1)).toBe(2);
    expect(nextSentenceIndex(sentences([false, false]), 2)).toBeUndefined();
  });
});
