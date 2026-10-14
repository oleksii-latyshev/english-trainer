import type { RecallResult, ReviewItem, ReviewRun } from '@/core/learning-memory';
import { currentPendingItem, isRunFinished, mergeRecallResult } from '@/core/learning-memory';
import type { Pending, ReviewActionError, ReviewStep, Session } from '../../types';

export const MAX_TRANSCRIPT_CHARS = 4000;

export function openSession(run: ReviewRun): Session {
  const step: ReviewStep = isRunFinished(run.items) ? { tag: 'closing' } : { tag: 'answering' };
  return { run, step, pending: 'none', actionError: null };
}

export function isTooLong(text: string): boolean {
  return [...text].length > MAX_TRANSCRIPT_CHARS;
}

export function pendingItem(session: Session): ReviewItem | null {
  return currentPendingItem(session.run.items);
}

export function shownItem(session: Session): ReviewItem | null {
  const { step, run } = session;
  if (step.tag !== 'result') return pendingItem(session);
  return run.items.find((item) => item.position === step.result.position) ?? null;
}

export function isTryingAgain(session: Session): boolean {
  return session.step.tag === 'result' && session.step.attempt.tag === 'recording';
}

export function isAnswering(session: Session): boolean {
  return session.step.tag === 'answering' || isTryingAgain(session);
}

export function isBusy(session: Session): boolean {
  return session.pending !== 'none';
}

export function begin(session: Session, pending: Exclude<Pending, 'none'>): Session {
  return { ...session, pending, actionError: null };
}

export function fail(session: Session, error: ReviewActionError): Session {
  return { ...session, pending: 'none', actionError: error };
}

export function settle(session: Session): Session {
  return { ...session, pending: 'none' };
}

export function clearError(session: Session): Session {
  return { ...session, actionError: null };
}

export function saved(session: Session, result: RecallResult): Session | null {
  const run = mergeRecallResult(session.run, result);
  if (run === null) return null;
  return {
    run,
    step: { tag: 'result', result, attempt: { tag: 'saved' } },
    pending: 'none',
    actionError: null,
  };
}

export function skipped(session: Session, run: ReviewRun): Session {
  return { ...session, run, pending: 'none', actionError: null };
}

export function summarized(session: Session): Session {
  return { ...session, step: { tag: 'summary' }, pending: 'none', actionError: null };
}

export function startPractice(session: Session): Session {
  const { step } = session;
  if (step.tag !== 'result') return session;
  return { ...session, step: { ...step, attempt: { tag: 'recording' } } };
}

export function practiced(session: Session, transcript: string): Session {
  const { step } = session;
  if (step.tag !== 'result' || step.attempt.tag !== 'recording') return session;
  return { ...session, step: { ...step, attempt: { tag: 'tried', transcript } } };
}

export function cancelPractice(session: Session): Session {
  const { step } = session;
  if (step.tag !== 'result') return session;
  return { ...session, step: { ...step, attempt: { tag: 'saved' } } };
}

export function nextItem(session: Session): Session {
  return { ...session, step: { tag: 'answering' } };
}

export function isFinished(session: Session): boolean {
  return isRunFinished(session.run.items);
}
