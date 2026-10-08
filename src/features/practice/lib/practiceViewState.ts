import type { FollowUpState } from '@/features/conversation/FollowUpPanel';
import type { SessionDetails } from './practiceState';
import type { SentAnswer } from './sentAnswer';
import type { SendFailure } from './turnIssue';

type FollowUpErrorCode = Extract<FollowUpState, { tag: 'error' }>['code'];

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
  return session && session.turnCount >= session.targetTurns ? session.sessionId : undefined;
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

/** Provider failures where the model did not answer, so trying another model can help. */
const UNRESPONSIVE_CODES: FollowUpErrorCode[] = [
  'timeout',
  'rate_limited',
  'process_failed',
  'invalid_output',
];

/** A failed send as the turn screen shows it; only a missing setup cannot be fixed by retrying. */
export function sendFailure(state: FollowUpState): SendFailure | undefined {
  if (state.tag !== 'error') return undefined;
  return {
    message: state.message,
    needsSetup: state.code === 'unavailable' || state.code === 'unauthorized',
    isUnresponsive: UNRESPONSIVE_CODES.includes(state.code),
  };
}
