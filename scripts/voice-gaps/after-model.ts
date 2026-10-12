import {
  cutPhrase,
  FIRST_PHRASE_BUDGET,
  laterPhraseBudget,
} from '@/core/speech/helpers/phrase-plan';
import { splitSentences } from '@/core/speech/helpers/reply-sentences';
import { INITIAL_SYNTHESIS_ESTIMATE } from '@/core/speech/helpers/speech-timing';
import {
  observeSynthesis,
  pauseBeforeMs,
  renderDelayMs,
  type SynthesisEstimate,
  synthesisGuardMs,
} from '@/core/speech/helpers/synthesis-pacing';
import type { Helper, TrimSettings } from './helper-client';
import type { PhraseTiming, ReplyRun } from './report';

export async function runAheadModel(
  helper: Helper,
  text: string,
  voiceId: number,
  speed: number,
  trim: TrimSettings,
): Promise<ReplyRun> {
  const timings: PhraseTiming[] = [];
  let pending = splitSentences(text);
  let estimate: SynthesisEstimate = INITIAL_SYNTHESIS_ESTIMATE;
  let renderClock = 0;
  let queueEnd = 0;
  let previousPhrase: string | null = null;
  let fallbackAt: number | null = null;
  let totalPhrases = 0;
  while (pending.length > 0) {
    const lead = Math.max(0, queueEnd - renderClock);
    const delay = renderDelayMs(lead);
    if (delay > 0) {
      renderClock += delay;
      continue;
    }
    const hasAudio = timings.length > 0;
    const budget = hasAudio ? laterPhraseBudget(lead, estimate) : FIRST_PHRASE_BUDGET;
    const cut = cutPhrase(pending, budget);
    if (!cut) break;
    pending = [...cut.rest];
    totalPhrases += 1;
    const clip = (await helper.synthesize(cut.phrase, voiceId, speed)).measure(trim);
    if (clip.synthMs > synthesisGuardMs(hasAudio ? lead : null)) {
      fallbackAt = totalPhrases - 1;
      break;
    }
    renderClock += clip.synthMs;
    const startAt = Math.max(renderClock, queueEnd + pauseBeforeMs(previousPhrase));
    queueEnd = startAt + clip.audioMs;
    timings.push({
      text: cut.phrase,
      synthMs: clip.synthMs,
      audioMs: clip.audioMs,
      startAt,
      endAt: queueEnd,
      leadSilenceMs: clip.leadSilenceMs,
      tailSilenceMs: clip.tailSilenceMs,
    });
    estimate = observeSynthesis(estimate, cut.phrase.length, clip.synthMs);
    previousPhrase = cut.phrase;
  }
  return { phrases: timings, fallbackAt, totalPhrases };
}
