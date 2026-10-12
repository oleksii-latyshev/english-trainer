import {
  ESTIMATE_SMOOTHING,
  FIRST_PHRASE_GUARD_MS,
  LATER_PHRASE_GUARD_MARGIN_MS,
  MAX_PER_CHAR_MS,
  MIN_PER_CHAR_MS,
  RENDER_AHEAD_TARGET_MS,
  SENTENCE_PAUSE_MS,
} from '../speech-timing';

export type SynthesisEstimate = {
  readonly fixedMs: number;
  readonly perCharMs: number;
};

const SENTENCE_END = /[.!?]["'”’)]*$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function observeSynthesis(
  estimate: SynthesisEstimate,
  chars: number,
  synthMs: number,
): SynthesisEstimate {
  if (chars <= 0) return estimate;
  const observedPerChar = (synthMs - estimate.fixedMs) / chars;
  const blended =
    estimate.perCharMs * (1 - ESTIMATE_SMOOTHING) + observedPerChar * ESTIMATE_SMOOTHING;
  return { ...estimate, perCharMs: clamp(blended, MIN_PER_CHAR_MS, MAX_PER_CHAR_MS) };
}

export function synthesisGuardMs(leadMs: number | null): number {
  if (leadMs === null) return FIRST_PHRASE_GUARD_MS;
  return Math.max(FIRST_PHRASE_GUARD_MS, leadMs + LATER_PHRASE_GUARD_MARGIN_MS);
}

export function renderDelayMs(leadMs: number): number {
  return Math.max(0, leadMs - RENDER_AHEAD_TARGET_MS);
}

export function pauseBeforeMs(previousPhrase: string | null): number {
  if (previousPhrase === null) return 0;
  return SENTENCE_END.test(previousPhrase.trim()) ? SENTENCE_PAUSE_MS : 0;
}
