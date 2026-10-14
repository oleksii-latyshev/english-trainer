import type { LearningStatus } from '@/core/ipc';
import type { RecallResult } from '@/core/learning-memory';
import { returnsIn, type StatusMove, statusMove } from '../review-summary';
import { hasWording, highlightWording, type WordingSegment } from '../wording-match';

export type Attempt =
  | { readonly tag: 'saved' }
  | { readonly tag: 'recording' }
  | { readonly tag: 'tried'; readonly transcript: string };

export type ResultView = {
  readonly tone: 'used' | 'not-yet';
  readonly title: string;
  readonly hint: { readonly move?: StatusMove; readonly text: string };
  readonly segments: readonly WordingSegment[];
  readonly caption?: string;
  readonly showsModel: boolean;
  readonly canTryAgain: boolean;
};

const PRACTICE_NOTE = 'This try is for practice. Your saved result stays as it was.';

function savedView(
  result: RecallResult,
  statusBefore: LearningStatus | null,
  segments: readonly WordingSegment[],
): ResultView {
  const comesBack = returnsIn(result.interval_days);
  if (result.wording_observed) {
    return {
      tone: 'used',
      title: 'Used it',
      hint: {
        move: statusMove(statusBefore, result.status),
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
    hint: { text: `Good answer — the phrase just didn’t come up. It’ll be back ${comesBack}.` },
    segments,
    showsModel: true,
    canTryAgain: true,
  };
}

export function describeResult(
  result: RecallResult,
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
