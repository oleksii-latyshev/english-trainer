import { FeedbackPanel } from '@/features/coach/FeedbackPanel';
import { deletePhraseCard, savePhraseCard } from '@/features/memory/memoryApi';
import type { TurnFeedback } from '@/lib/types';
import type { SessionDetails } from './lib/practiceState';
import type { SentAnswer } from './lib/sentAnswer';

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
  onPhraseSaved: () => void;
  onPhraseSaveUndone: () => void;
  onPersistFeedback: (
    sessionId: number,
    sequence: number,
    transcript: string,
    feedback: TurnFeedback,
  ) => Promise<void>;
  onSpeakRewrite: (text: string) => void;
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
  onPhraseSaved,
  onPhraseSaveUndone,
  onPersistFeedback,
  onSpeakRewrite,
}: Props) {
  if ((!transcript && !retryAnchor && !savedAnswer) || recallActive) return null;
  const isAnswerSent = session === undefined || savedAnswer !== null || retryAnchor !== null;
  const effectiveSessionId = savedAnswer?.sessionId ?? retryAnchor?.sessionId;
  const effectiveSequence = savedAnswer?.sequence ?? retryAnchor?.sequence;
  return (
    <FeedbackPanel
      canReview={!isRetrying && (savedAnswer !== null || session === undefined)}
      initialFeedback={retryAnchor?.feedback}
      isAnswerSent={isAnswerSent}
      isCurrent={isCurrent}
      key={`feedback-${retryAnchor?.requestId ?? savedAnswer?.requestId ?? requestId}`}
      onReviewed={(feedback) => {
        if (savedAnswer) onRetryAnchor({ ...savedAnswer, feedback });
      }}
      onPhraseSaved={onPhraseSaved}
      onPhraseSaveUndone={onPhraseSaveUndone}
      onSavePhrase={savePhraseCard}
      onUndoSavePhrase={deletePhraseCard}
      onSpeakRewrite={onSpeakRewrite}
      onTryAgain={retryAnchor ? onTryAgain : undefined}
      persistReviewed={
        savedAnswer
          ? (_answer, feedback) =>
              onPersistFeedback(
                savedAnswer.sessionId,
                savedAnswer.sequence,
                savedAnswer.originalTranscript,
                feedback,
              )
          : undefined
      }
      question={feedbackQuestion(retryAnchor, savedAnswer, session?.question)}
      sequence={effectiveSequence}
      sessionId={effectiveSessionId}
      transcript={
        retryAnchor?.originalTranscript ?? savedAnswer?.originalTranscript ?? transcript ?? ''
      }
    />
  );
}
