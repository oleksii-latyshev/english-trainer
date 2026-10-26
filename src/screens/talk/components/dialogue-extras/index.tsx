import { useAtomValue } from '@effect/atom-react';
import type { SessionDetails } from '@/core/practice-session';
import { acceptedAnswerAtom } from '@/core/practice-turn';
import { SpokenRecall } from '@/features/spoken-recall';
import { useDialogue } from '@/features/talk-dialogue';
import { UsageReviewCard, usageReviewTarget } from '@/features/usage-review';
import { offersRecall } from '../../helpers/availability';
import type { TalkGuards } from '../../model/use-talk-guards';

type Props = {
  session: SessionDetails;
  guards: TalkGuards;
};

export function DialogueExtras({ session, guards }: Props) {
  const accepted = useAtomValue(acceptedAnswerAtom);
  const { dialogue } = useDialogue();
  const reviewed = usageReviewTarget({
    answer: accepted && { sessionId: accepted.sessionId, sequence: accepted.sequence },
    session,
    dialogue,
    isBlocked: guards.isRetrying || guards.isRecalling,
  });
  return (
    <>
      {offersRecall(session) && (
        <SpokenRecall isStartBlocked={guards.isRetrying} sessionId={session.sessionId} />
      )}
      {reviewed && <UsageReviewCard target={reviewed} />}
    </>
  );
}
