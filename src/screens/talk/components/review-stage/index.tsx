import type { SessionDetails } from '@/core/practice-session';
import { AnswerReview } from '@/features/coaching-note';
import { HISTORY_FAILED_MESSAGE, useDialogue } from '@/features/talk-dialogue';
import { type ReviewedAnswerRef, WriteSpeakReview } from '@/features/write-speak';
import type { TalkGuards } from '../../model/use-talk-guards';

type Props = {
  session: SessionDetails;
  guards: TalkGuards;
};

function renderAnswerReview(answer: ReviewedAnswerRef) {
  return (
    <AnswerReview
      coaching={answer.coaching}
      target={{ sessionId: answer.sessionId, sequence: answer.sequence }}
      transcript={answer.transcript}
    />
  );
}

export function ReviewStage({ session, guards }: Props) {
  const history = useDialogue();
  return (
    <WriteSpeakReview
      dialogue={history.dialogue}
      historyError={history.hasFailed ? HISTORY_FAILED_MESSAGE : ''}
      isLocked={guards.isRetrying}
      onRetryHistory={history.retry}
      renderAnswerReview={renderAnswerReview}
      session={session}
    />
  );
}
