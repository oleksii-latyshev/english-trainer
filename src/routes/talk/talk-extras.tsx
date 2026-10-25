import type { SessionDetails } from '@/core/practice-session';
import type { SentAnswer } from '@/core/practice-turn';
import { SpokenRecall } from '@/features/spoken-recall';
import { UsageReviewCard, usageReviewTarget } from '@/features/usage-review';
import type { PracticeDialogue } from '@/lib/dialogueTypes';

type Props = {
  session: SessionDetails;
  dialogue: PracticeDialogue | null;
  accepted: SentAnswer | null;
  isRetrying: boolean;
  isRecalling: boolean;
};

function offersRecall(session: SessionDetails): boolean {
  if (session.isMistakePractice) return false;
  if (session.practiceMode !== 'voice' || session.practicePhase !== 'speaking') return false;
  return session.turnCount >= session.targetTurns;
}

export function TalkExtras({ session, dialogue, accepted, isRetrying, isRecalling }: Props) {
  const reviewed = usageReviewTarget({
    answer: accepted && { sessionId: accepted.sessionId, sequence: accepted.sequence },
    session,
    dialogue,
    isBlocked: isRetrying || isRecalling,
  });
  return (
    <>
      {offersRecall(session) && (
        <SpokenRecall isStartBlocked={isRetrying} sessionId={session.sessionId} />
      )}
      {reviewed && <UsageReviewCard target={reviewed} />}
    </>
  );
}
