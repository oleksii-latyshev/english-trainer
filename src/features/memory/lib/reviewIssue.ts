import type { TranscriptionRecovery } from '@/features/speech/transcriptionRecovery';

/** A step of the review that failed after the learner had done their part. */
export type ReviewActionError = 'save' | 'too-long' | 'skip' | 'finish';

export type ReviewFix =
  | 'transcribe-again'
  | 'record-again'
  | 'open-settings'
  | 'save-again'
  | 'skip-again'
  | 'finish-again';

export type ReviewIssue = { message: string; fix: ReviewFix };

export const REVIEW_FIX_LABEL: Record<ReviewFix, string> = {
  'transcribe-again': 'Retry transcription',
  'record-again': 'Try again',
  'open-settings': 'Open Settings',
  'save-again': 'Retry save',
  'skip-again': 'Try skipping again',
  'finish-again': 'Retry finish',
};

const ACTION_ISSUE: Record<ReviewActionError, ReviewIssue> = {
  save: {
    message: 'Could not save this answer. Your words are kept, so you can try again.',
    fix: 'save-again',
  },
  'too-long': {
    message: 'That answer is over 4000 characters. Record a shorter one.',
    fix: 'record-again',
  },
  skip: { message: 'Could not skip this one. Please try again.', fix: 'skip-again' },
  finish: {
    message: 'Could not finish the review. Your answers are safe; try again when ready.',
    fix: 'finish-again',
  },
};

const RECOVERY_FIX: Record<TranscriptionRecovery['kind'], ReviewFix> = {
  retry: 'transcribe-again',
  record_again: 'record-again',
  setup: 'open-settings',
};

export type IssueSignals = {
  actionError: ReviewActionError | null;
  transcriptionFailure?: TranscriptionRecovery;
  /** A recording or microphone problem, already in words. */
  captureError: string;
};

/** The one problem to show beside the microphone: a failed step outranks a failed recording. */
export function reviewIssue(signals: IssueSignals): ReviewIssue | null {
  if (signals.actionError) return ACTION_ISSUE[signals.actionError];
  const failure = signals.transcriptionFailure;
  if (failure) return { message: failure.message, fix: RECOVERY_FIX[failure.kind] };
  if (signals.captureError) return { message: signals.captureError, fix: 'record-again' };
  return null;
}
