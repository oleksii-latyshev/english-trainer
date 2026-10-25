import type { SessionDetails } from '@/core/practice-session';
import type { HelpTarget } from '../../types';

export function helpKeyOf(session: SessionDetails | undefined): string {
  if (session === undefined) return 'none';
  return `${session.sessionId}:${session.practicePhase}:${session.turnCount + 1}:${session.question}`;
}

export function helpTargetOf(session: SessionDetails | undefined): HelpTarget | null {
  if (session === undefined) return null;
  return {
    sessionId: session.sessionId,
    sequence: session.turnCount + 1,
    question: session.question,
    key: helpKeyOf(session),
  };
}
