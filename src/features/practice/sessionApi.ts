import { invoke } from '@tauri-apps/api/core';
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
  type TurnFeedback,
} from '@/lib/types';

export async function startPracticeSession(): Promise<PracticeSession> {
  const result = await invoke<unknown>('start_practice_session');
  if (!isPracticeSession(result)) throw new Error('Unexpected practice session response.');
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

export async function savePracticeFeedback(
  sessionId: number,
  sequence: number,
  transcript: string,
  feedback: TurnFeedback,
): Promise<void> {
  await invoke<void>('save_practice_feedback', {
    sessionId,
    sequence,
    transcript,
    feedback,
  });
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
