import { splitSentences } from '@/core/speech/helpers/reply-sentences';
import type { Helper, TrimSettings } from './helper-client';
import type { PhraseTiming, ReplyRun } from './report';

const UI_GUARD_MS = 800;
const MAX_PHRASE_CHARS = 48;
const MIN_CLAUSE_CHARS = 24;
const CLAUSE_BREAK = /[,;:]\s+|\s+(?=(?:and|but|because|so|which|when)\s)/g;

function previousSplit(text: string): string[] {
  const phrases: string[] = [];
  let remaining = text.trim();
  while (remaining.length > MAX_PHRASE_CHARS) {
    const prefix = remaining.slice(0, MAX_PHRASE_CHARS + 1);
    const candidates = [...prefix.matchAll(CLAUSE_BREAK)]
      .map((match) => match.index + (/[,;:]/.test(match[0][0] ?? '') ? 1 : 0))
      .filter((index) => index >= MIN_CLAUSE_CHARS && index <= MAX_PHRASE_CHARS);
    let cut = candidates[candidates.length - 1] ?? prefix.lastIndexOf(' ');
    if (cut <= 0) cut = remaining.indexOf(' ');
    if (cut <= 0) break;
    phrases.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) phrases.push(remaining);
  return phrases;
}

export async function runPreviousPipelineModel(
  helper: Helper,
  text: string,
  voiceId: number,
  speed: number,
  trim: TrimSettings,
): Promise<ReplyRun> {
  const phrases = splitSentences(text).flatMap(previousSplit);
  const timings: PhraseTiming[] = [];
  let previousStart = 0;
  let previousEnd = 0;
  let fallbackAt: number | null = null;
  for (const [index, phrase] of phrases.entries()) {
    const clip = (await helper.synthesize(phrase, voiceId, speed)).measure(trim);
    const readyAt = (index === 0 ? 0 : previousStart) + clip.synthMs;
    if (clip.synthMs > UI_GUARD_MS) {
      fallbackAt = index;
      break;
    }
    const startAt = index === 0 ? readyAt : Math.max(previousEnd, readyAt);
    timings.push({
      text: phrase,
      synthMs: clip.synthMs,
      audioMs: clip.audioMs,
      startAt,
      endAt: startAt + clip.audioMs,
      leadSilenceMs: clip.leadSilenceMs,
      tailSilenceMs: clip.tailSilenceMs,
    });
    previousStart = startAt;
    previousEnd = startAt + clip.audioMs;
  }
  return { phrases: timings, fallbackAt, totalPhrases: phrases.length };
}
