import { invoke } from '@tauri-apps/api/core';
import {
  isAttemptComparison,
  isFinishedPracticeSession,
  isPracticeSession,
  type PracticeSession,
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

export async function finishPracticeSession(sessionId: number): Promise<void> {
  const result = await invoke<unknown>('finish_practice_session', { sessionId });
  if (!isFinishedPracticeSession(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected practice session finish response.');
  }
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
