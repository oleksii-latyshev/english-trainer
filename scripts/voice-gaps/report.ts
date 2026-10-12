export type PhraseTiming = {
  readonly text: string;
  readonly synthMs: number;
  readonly audioMs: number;
  readonly startAt: number;
  readonly endAt: number;
  readonly leadSilenceMs: number;
  readonly tailSilenceMs: number;
};

export type ReplyRun = {
  readonly phrases: PhraseTiming[];
  readonly fallbackAt: number | null;
  readonly totalPhrases: number;
};

export type Gap = {
  readonly schedulingMs: number;
  readonly audibleMs: number;
  readonly insideSentence: boolean;
};

const SENTENCE_END = /[.!?]["'”’)]*$/;

export function gapsOf(run: ReplyRun): Gap[] {
  return run.phrases.slice(1).map((phrase, index) => {
    const previous = run.phrases[index];
    const schedulingMs = Math.max(0, phrase.startAt - (previous?.endAt ?? 0));
    return {
      schedulingMs,
      audibleMs: schedulingMs + (previous?.tailSilenceMs ?? 0) + phrase.leadSilenceMs,
      insideSentence: !SENTENCE_END.test(previous?.text ?? ''),
    };
  });
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function round(value: number): number {
  return Math.round(value);
}

export type Summary = {
  readonly replies: number;
  readonly phrases: number;
  readonly fallbacks: number;
  readonly synthMedianMs: number;
  readonly synthP95Ms: number;
  readonly synthMaxMs: number;
  readonly timeToFirstAudioMedianMs: number;
  readonly timeToFirstAudioMaxMs: number;
  readonly gapsInsideSentence: number;
  readonly insideSchedulingP95Ms: number;
  readonly insideSchedulingMaxMs: number;
  readonly insideAudibleMedianMs: number;
  readonly insideAudibleP95Ms: number;
  readonly insideAudibleMaxMs: number;
  readonly insideOver150Ms: number;
  readonly betweenSentencesAudibleMedianMs: number;
};

export function summarize(runs: ReplyRun[]): Summary {
  const phrases = runs.flatMap((run) => run.phrases);
  const synth = phrases.map((phrase) => phrase.synthMs).sort((a, b) => a - b);
  const first = runs.map((run) => run.phrases[0]?.startAt ?? 0).sort((a, b) => a - b);
  const gaps = runs.flatMap(gapsOf);
  const inside = gaps.filter((gap) => gap.insideSentence);
  const between = gaps.filter((gap) => !gap.insideSentence);
  const insideScheduling = inside.map((gap) => gap.schedulingMs).sort((a, b) => a - b);
  const insideAudible = inside.map((gap) => gap.audibleMs).sort((a, b) => a - b);
  const betweenAudible = between.map((gap) => gap.audibleMs).sort((a, b) => a - b);
  return {
    replies: runs.length,
    phrases: phrases.length,
    fallbacks: runs.filter((run) => run.fallbackAt !== null).length,
    synthMedianMs: round(percentile(synth, 0.5)),
    synthP95Ms: round(percentile(synth, 0.95)),
    synthMaxMs: round(synth[synth.length - 1] ?? 0),
    timeToFirstAudioMedianMs: round(percentile(first, 0.5)),
    timeToFirstAudioMaxMs: round(first[first.length - 1] ?? 0),
    gapsInsideSentence: inside.length,
    insideSchedulingP95Ms: round(percentile(insideScheduling, 0.95)),
    insideSchedulingMaxMs: round(insideScheduling[insideScheduling.length - 1] ?? 0),
    insideAudibleMedianMs: round(percentile(insideAudible, 0.5)),
    insideAudibleP95Ms: round(percentile(insideAudible, 0.95)),
    insideAudibleMaxMs: round(insideAudible[insideAudible.length - 1] ?? 0),
    insideOver150Ms: insideAudible.filter((gap) => gap > 150).length,
    betweenSentencesAudibleMedianMs: round(percentile(betweenAudible, 0.5)),
  };
}
