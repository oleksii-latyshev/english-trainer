import type { TurnFeedback } from '@/lib/types';
import type { SessionDetails } from './practiceState';
import type { SentAnswer } from './sentAnswer';

export function matchingSentAnswer(
  answer: SentAnswer | null,
  requestId: number,
  transcript: string | undefined,
) {
  return answer?.requestId === requestId && answer.originalTranscript === transcript
    ? answer
    : null;
}

export function recallSessionId(session: SessionDetails | undefined): number | undefined {
  return session?.mode === 'conversation' && session.turnCount >= session.targetTurns
    ? session.sessionId
    : undefined;
}

export function practicePromptSequence(session: SessionDetails | undefined): number | undefined {
  if (!session) return undefined;
  if (session.mode === 'coach' && session.coachState?.is_pending) {
    return session.coachState.sequence;
  }
  return session.turnCount + 1;
}

export function coachPromptQuestion(
  retryAnchor: SentAnswer | null,
  savedAnswer: SentAnswer | null,
  session: SessionDetails | undefined,
  isRetrying: boolean,
): string {
  if (isRetrying && retryAnchor) return retryAnchor.answeredQuestion;
  if (session?.mode === 'coach' && session.coachState?.is_pending === false)
    return session.question;
  return (
    retryAnchor?.answeredQuestion ??
    savedAnswer?.answeredQuestion ??
    session?.question ??
    'What was the most interesting part of your day?'
  );
}

export function shouldShowFollowUp(
  transcript: string | undefined,
  isRetrying: boolean,
  recallActive: boolean,
): transcript is string {
  return Boolean(transcript) && !isRetrying && !recallActive;
}

export function restoredCoachAnswer(session: SessionDetails | undefined): SentAnswer | null {
  if (!session?.coachState) return null;
  return {
    sessionId: session.coachState.session_id,
    sequence: session.coachState.sequence,
    originalTranscript: session.coachState.original_transcript,
    answeredQuestion: session.coachState.answered_question,
    requestId: -session.coachState.sequence,
  };
}

export function restoredRetryAnchor(
  answer: SentAnswer | null,
  feedback: TurnFeedback | null | undefined,
) {
  return answer && feedback ? { ...answer, feedback } : null;
}

type SessionGate = {
  practiceTag: string;
  isBusy: boolean;
  canChangeSession: boolean;
};

export function canSendAnswer(
  gate: SessionGate & { isPending: boolean; isRetrying: boolean; isRecalling: boolean },
): boolean {
  return (
    !gate.isPending &&
    !gate.isRetrying &&
    !gate.isRecalling &&
    gate.practiceTag === 'active' &&
    !gate.isBusy &&
    gate.canChangeSession
  );
}

export function canContinueCoach(
  session: SessionDetails | undefined,
  gate: SessionGate & { isContinuing: boolean },
): boolean {
  return (
    session?.mode === 'coach' &&
    session.coachState?.is_pending === true &&
    !gate.isContinuing &&
    gate.practiceTag === 'active' &&
    gate.canChangeSession &&
    !gate.isBusy
  );
}
