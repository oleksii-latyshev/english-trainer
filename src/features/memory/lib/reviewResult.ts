import type { LearningStatus } from '@/lib/learningTypes';
import type { MemoryRecallResult } from '@/lib/memoryRecallTypes';
import { returnsIn, statusMove } from './memoryRecallState';
import { hasWording, highlightWording, type WordingSegment } from './wordingMatch';

/** A try after the saved answer: it is shown with the wording marked, never scored. */
export type Attempt =
  | { tag: 'saved' }
  | { tag: 'recording' }
  | { tag: 'tried'; transcript: string };

export type ResultView = {
  tone: 'used' | 'not-yet';
  title: string;
  /** Bold lead-in, then the rest of the sentence. */
  hint: { lead?: string; text: string };
  /** The learner's words with the wording marked. */
  segments: WordingSegment[];
  /** Set for a practice try, which the saved result does not count. */
  caption?: string;
  /** Show what to say, for a try that missed. */
  showsModel: boolean;
  canTryAgain: boolean;
};

const PRACTICE_NOTE = 'This try is for practice. Your saved result stays as it was.';

function savedView(
  result: MemoryRecallResult,
  statusBefore: LearningStatus | null,
  segments: WordingSegment[],
): ResultView {
  const comesBack = returnsIn(result.interval_days);
  if (result.wording_observed) {
    return {
      tone: 'used',
      title: 'Used it',
      hint: {
        lead: statusMove(statusBefore, result.status),
        text: ` — it’ll come back ${comesBack}.`,
      },
      segments,
      showsModel: false,
      canTryAgain: false,
    };
  }
  return {
    tone: 'not-yet',
    title: 'Not yet',
    hint: { text: `The wording didn’t come up this time. It’ll be back ${comesBack}.` },
    segments,
    showsModel: true,
    canTryAgain: true,
  };
}

/**
 * What the result screen says. The saved answer is judged by Rust (`wording_observed`); only a
 * practice try, which is not saved, is read here with the same whole-word match.
 */
export function describeResult(
  result: MemoryRecallResult,
  attempt: Exclude<Attempt, { tag: 'recording' }>,
  statusBefore: LearningStatus | null,
): ResultView {
  if (attempt.tag === 'saved') {
    return savedView(result, statusBefore, highlightWording(result.target, result.transcript));
  }
  const segments = highlightWording(result.target, attempt.transcript);
  const isUsed = hasWording(segments);
  return {
    tone: isUsed ? 'used' : 'not-yet',
    title: isUsed ? 'The wording came up this time' : 'Still not there',
    hint: { text: PRACTICE_NOTE },
    segments,
    caption: 'Practice try',
    showsModel: !isUsed,
    canTryAgain: !isUsed,
  };
}
