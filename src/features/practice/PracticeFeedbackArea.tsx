import { FeedbackPanel } from '@/features/coach/FeedbackPanel';
import { savePhraseCard } from '@/features/memory/memoryApi';
import type { TurnFeedback } from '@/lib/types';
import type { SessionDetails } from './lib/practiceState';
import type { SentAnswer } from './lib/sentAnswer';
import { savePracticeFeedback } from './sessionApi';

type ReviewedAnswer = SentAnswer & { feedback: TurnFeedback };

type Props = {
  transcript?: string;
  requestId: number;
  session?: SessionDetails;
  savedAnswer: SentAnswer | null;
  retryAnchor: ReviewedAnswer | null;
  isRetrying: boolean;
  recallActive: boolean;
  isCurrent: () => boolean;
  onRetryAnchor: (answer: ReviewedAnswer) => void;
  onTryAgain: () => void;
};

function feedbackQuestion(
  retryAnchor: SentAnswer | null,
  savedAnswer: SentAnswer | null,
  sessionQuestion?: string,
): string {
  return (
    retryAnchor?.answeredQuestion ??
    savedAnswer?.answeredQuestion ??
    sessionQuestion ??
    'What was the most interesting part of your day?'
  );
}

export function PracticeFeedbackArea({
  transcript,
  requestId,
  session,
  savedAnswer,
  retryAnchor,
  isRetrying,
  recallActive,
  isCurrent,
  onRetryAnchor,
  onTryAgain,
}: Props) {
  if ((!transcript && !retryAnchor) || recallActive) return null;
  return (
    <FeedbackPanel
      isCurrent={isCurrent}
      key={`feedback-${retryAnchor?.requestId ?? requestId}`}
      onReviewed={(feedback) => {
        if (savedAnswer) onRetryAnchor({ ...savedAnswer, feedback });
      }}
      onSavePhrase={savePhraseCard}
      onTryAgain={retryAnchor ? onTryAgain : undefined}
      initialFeedback={isRetrying ? retryAnchor?.feedback : undefined}
      isAnswerSent={session === undefined || savedAnswer !== null || retryAnchor !== null}
      canReview={!isRetrying}
      sessionId={savedAnswer?.sessionId ?? retryAnchor?.sessionId}
      sequence={savedAnswer?.sequence ?? retryAnchor?.sequence}
      persistReviewed={
        savedAnswer
          ? (_answer, feedback) =>
              savePracticeFeedback(
                savedAnswer.sessionId,
                savedAnswer.sequence,
                savedAnswer.originalTranscript,
                feedback,
              )
          : undefined
      }
      question={feedbackQuestion(retryAnchor, savedAnswer, session?.question)}
      transcript={retryAnchor?.originalTranscript ?? transcript ?? ''}
    />
  );
}
