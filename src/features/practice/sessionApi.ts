import { invoke } from '@tauri-apps/api/core';
import { isPracticeDialogue, type PracticeDialogue } from '@/lib/dialogueTypes';
import { createReplyChannel } from '@/lib/replyStream';
import {
  type ConversationTurn,
  type DailyRecallPlan,
  type FinishedPracticeSession,
  isAttemptComparison,
  isConversationTurn,
  isDailyRecallPlan,
  isFinishedPracticeSession,
  isPracticeSession,
  isSavedCoachState,
  isSpokenRecallResult,
  type PracticeSession,
  type SavedCoachState,
  type SessionMode,
  type SpokenRecallResult,
  type TurnFeedback,
} from '@/lib/types';
import type { InputSource } from './lib/inputSource';

export async function startPracticeSession(mode?: SessionMode): Promise<PracticeSession> {
  const result = await invoke<unknown>('start_practice_session', { mode });
  if (!isPracticeSession(result)) throw new Error('Unexpected practice session response.');
  return result;
}

export async function saveCoachAnswer(
  sessionId: number,
  transcript: string,
  inputSource: InputSource = 'text',
  answerDurationMs?: number,
): Promise<SavedCoachState> {
  const result = await invoke<unknown>('save_coach_answer', {
    sessionId,
    transcript,
    inputSource,
    answerDurationMs,
  });
  if (!isSavedCoachState(result) || result.session_id !== sessionId) {
    throw new Error('Unexpected coach answer response.');
  }
  return result;
}

export async function continueCoachTurn(
  sessionId: number,
  sequence: number,
  onDelta: (text: string) => void = () => {},
): Promise<ConversationTurn> {
  const result = await invoke<unknown>('continue_coach_turn', {
    sessionId,
    sequence,
    onReply: createReplyChannel(onDelta),
  });
  if (!isConversationTurn(result)) {
    throw new Error('Unexpected coach continue response.');
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
