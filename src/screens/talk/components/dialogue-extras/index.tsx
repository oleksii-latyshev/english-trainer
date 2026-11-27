import type { SessionDetails } from '@/core/practice-session';
import { SpokenRecall } from '@/features/spoken-recall';
import { offersRecall } from '../../helpers/availability';
import type { TalkGuards } from '../../model/use-talk-guards';

type Props = {
  session: SessionDetails;
  guards: TalkGuards;
};

export function DialogueExtras({ session, guards }: Props) {
  return (
    offersRecall(session) && (
      <SpokenRecall isStartBlocked={guards.isRetrying} sessionId={session.sessionId} />
    )
  );
}
