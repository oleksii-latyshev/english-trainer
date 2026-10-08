import type { ModelRun, SentenceStatus, SpeechCheckProgress, SpeechModel } from '@/lib/speechTypes';

export function formatPercent(ratio: number | null): string {
  return ratio === null ? 'no terms' : `${Math.round(ratio * 100)}%`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1000) return `${(megabytes / 1024).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(megabytes))} MB`;
}

/** `ggml-base.en.bin` reads as `base.en`. */
export function modelName(file: string): string {
  return file.replace(/^ggml-/, '').replace(/\.bin$/, '');
}

export function plainRun(runs: readonly ModelRun[], file: string): ModelRun | undefined {
  return runs.find((run) => run.model_file === file && !run.uses_prompt);
}

/** An option of the Model select: the model, its size and, once measured, how well it did. */
export function modelOptionLabel(model: SpeechModel, run: ModelRun | undefined): string {
  const base = `${modelName(model.file)} · ${formatSize(model.size_bytes)}`;
  if (!run) return `${base} · not measured`;
  return `${base} · terms ${formatPercent(run.term_accuracy)} · errors ${formatPercent(run.word_error_rate)} · ${formatSeconds(run.median_ms)}`;
}

export function progressText(progress: SpeechCheckProgress): string {
  if (progress.model_file === '') return 'Saving the measurements…';
  const prompt = progress.uses_prompt ? ' with the glossary prompt' : '';
  return `${modelName(progress.model_file)}${prompt}: ${progress.done} of ${progress.total} recordings done`;
}

export function glossarySummary(terms: readonly string[], shown = 5): string {
  if (terms.length === 0) return 'No words yet.';
  const list = terms.slice(0, shown).join(', ');
  return terms.length > shown ? `${list}…` : list;
}

/** The sentence to read after `current`: the next one still to record, else simply the next. */
export function nextSentenceIndex(
  sentences: readonly SentenceStatus[],
  current: number,
): number | undefined {
  const later = sentences.filter((sentence) => sentence.index > current);
  return (later.find((sentence) => !sentence.is_recorded) ?? later[0])?.index;
}

/** The first sentence the learner has not read yet, or the first one. */
export function startingSentenceIndex(sentences: readonly SentenceStatus[]): number {
  return sentences.find((sentence) => !sentence.is_recorded)?.index ?? sentences[0]?.index ?? 1;
}
