import type { SessionDetails } from '@/core/practice-session';
import type { RescueTarget } from '../../types';

export function rescueTargetOf(
  session: SessionDetails | undefined,
  recordingId: number,
): RescueTarget | null {
  if (session === undefined) return null;
  const sequence = session.turnCount + 1;
  return {
    sessionId: session.sessionId,
    sequence,
    question: session.question,
    recordingId,
    key: `${session.sessionId}:${session.practicePhase}:${sequence}:${session.question}:${recordingId}`,
  };
}
