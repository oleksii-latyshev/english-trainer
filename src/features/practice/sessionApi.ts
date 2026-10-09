import { invoke } from '@tauri-apps/api/core';
import { isPracticeDialogue, type PracticeDialogue } from '@/lib/dialogueTypes';
import type { PracticeOptions, PracticePhase } from '@/lib/practiceOptions';
import {
  type DailyRecallPlan,
  type FinishedPracticeSession,
  isAttemptComparison,
  isDailyRecallPlan,
  isFinishedPracticeSession,
  isPracticeSession,
  isSpokenRecallResult,
  type PracticeSession,
  type SpokenRecallResult,
} from '@/lib/types';

export async function startPracticeSession(options?: PracticeOptions): Promise<PracticeSession> {
  const result: unknown = options
    ? await invoke<unknown>('start_practice_session', { options })
    : await invoke<unknown>('start_practice_session');
  if (!isPracticeSession(result)) throw new Error('Unexpected practice session response.');
  return result;
}

export async function setPracticeClock(
  sessionId: number,
  running: boolean,
): Promise<PracticeSession> {
  const result = await invoke<unknown>('set_practice_clock', { sessionId, running });
  if (!isPracticeSession(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected practice clock response.');
  }
  return result;
}

export async function transitionPracticePhase(
  sessionId: number,
  phase: PracticePhase,
): Promise<PracticeSession> {
  const result = await invoke<unknown>('transition_practice_phase', { sessionId, phase });
  if (!isPracticeSession(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected practice phase transition response.');
  }
  return result;
}

export async function getActivePracticeSession(): Promise<PracticeSession | null> {
  const result = await invoke<unknown>('get_active_practice_session');
  if (result === null) return null;
  if (!isPracticeSession(result)) throw new Error('Unexpected active practice session response.');
  return result;
}

export async function finishPracticeSession(sessionId: number): Promise<FinishedPracticeSession> {
  const result = await invoke<unknown>('finish_practice_session', { sessionId });
  if (!isFinishedPracticeSession(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected practice session finish response.');
  }
  return result;
}

export async function getDailyRecallPlan(sessionId: number): Promise<DailyRecallPlan> {
  const result = await invoke<unknown>('get_daily_recall_plan', { sessionId });
  if (!isDailyRecallPlan(result)) throw new Error('Unexpected daily recall plan response.');
  return result;
}

export async function submitDailyRecall(
  sessionId: number,
  phraseId: number,
  transcript: string,
): Promise<SpokenRecallResult> {
  const result = await invoke<unknown>('submit_daily_recall', { sessionId, phraseId, transcript });
  if (!isSpokenRecallResult(result) || result.phrase_id !== phraseId) {
    throw new Error('Unexpected spoken recall response.');
  }
  return result;
}

/** Gives an answer that could not be checked another try and resumes paused coaching. */
export async function retryAnswerCoaching(sessionId: number, sequence: number): Promise<void> {
  await invoke<void>('retry_answer_coaching', { sessionId, sequence });
}

/** The wrap-up of a finished session as it stands now, after more coaching landed. */
export async function getSessionWrapup(sessionId: number): Promise<FinishedPracticeSession> {
  const result = await invoke<unknown>('get_session_wrapup', { sessionId });
  if (!isFinishedPracticeSession(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected session wrap-up response.');
  }
  return result;
}

export async function retryPracticeTurn(sessionId: number, sequence: number, transcript: string) {
  const result = await invoke<unknown>('retry_practice_turn', {
    sessionId,
    sequence,
    transcript,
  });
  if (!isAttemptComparison(result)) throw new Error('Unexpected retry comparison response.');
  return result;
}

/** Records that help was opened for the answer to the current question; once per answer is enough. */
export async function recordAnswerHelpUsed(sessionId: number, sequence: number): Promise<void> {
  await invoke<void>('record_answer_help_used', { sessionId, sequence });
}

export async function getPracticeDialogue(sessionId: number): Promise<PracticeDialogue> {
  const result = await invoke<unknown>('get_practice_dialogue', { sessionId });
  if (!isPracticeDialogue(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected practice dialogue response.');
  }
  return result;
}
