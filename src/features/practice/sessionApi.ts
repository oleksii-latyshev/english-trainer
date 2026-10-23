import { invoke } from '@tauri-apps/api/core';
import { refreshLearningMemory } from '@/core/learning-memory';
import {
  type DailyRecallPlan,
  type FinishedPracticeSession,
  isAttemptComparison,
  isDailyRecallPlan,
  isFinishedPracticeSession,
  isSpokenRecallResult,
  type SpokenRecallResult,
} from '@/lib/types';
import { isSavedWrapupPhrases, type SavedWrapupPhrases } from '@/lib/wrapupTypes';

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

/** Retries background phrase preparation for a failed or legacy session. */
export async function retrySessionWrapup(sessionId: number): Promise<void> {
  await invoke<void>('retry_session_wrapup', { sessionId });
}

/** Saves the selected wrap-up phrases as one atomic operation. */
export async function saveWrapupPhrases(
  sessionId: number,
  phrases: string[],
): Promise<SavedWrapupPhrases> {
  const result = await invoke<unknown>('save_wrapup_phrases', { sessionId, phrases });
  if (!isSavedWrapupPhrases(result)) {
    throw new Error('Unexpected saved session phrases response.');
  }
  refreshLearningMemory();
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
