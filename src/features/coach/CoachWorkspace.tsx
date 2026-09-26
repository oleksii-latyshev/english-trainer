import { Button, Card } from '@heroui/react';
import type { SessionDetails } from '@/features/practice/lib/practiceState';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import { PracticeControls } from '@/features/practice/PracticeControls';
import { PracticeFeedbackArea } from '@/features/practice/PracticeFeedbackArea';
import type { PracticeActions, PracticeViewModel } from '@/features/practice/practiceViewModel';
import { retryPracticeTurn } from '@/features/practice/sessionApi';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { TurnFeedback } from '@/lib/types';
import { deriveCoachStep } from './lib/coachState';
import { RetryComparisonPanel } from './RetryComparisonPanel';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  session?: SessionDetails;
  savedAnswer: SentAnswer | null;
  retryAnchor: (SentAnswer & { feedback: TurnFeedback }) | null;
  isRetrying: boolean;
  isCurrent: () => boolean;
  onRetryAnchor: (answer: SentAnswer & { feedback: TurnFeedback }) => void;
  onTryAgain: () => void;
  onCancelRetry: () => void;
  onContinueFromRetry: () => void;
  onNavigateToConversation: () => void;
};

function stepBadgeClass(isActive: boolean): string {
  if (isActive) {
    return 'rounded bg-teal-500/20 px-2 py-0.5 font-semibold text-teal-200 border border-teal-500/40';
  }
  return 'rounded px-2 py-0.5 text-slate-400';
}

function promptQuestion(
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

export function CoachWorkspace({
  model,
  actions,
  speech,
  session,
  savedAnswer,
  retryAnchor,
  isRetrying,
  isCurrent,
  onRetryAnchor,
  onTryAgain,
  onCancelRetry,
  onContinueFromRetry,
  onNavigateToConversation,
}: Props) {
  const { transcript, currentRequestId } = model;
  const currentStep = deriveCoachStep({
    hasSession: session !== undefined,
    hasTranscript: Boolean(transcript),
    savedAnswer,
    retryAnchor,
    isRetrying,
    hasComparison:
      session?.retryEvidence.some((evidence) => evidence.turn_sequence === retryAnchor?.sequence) ??
      false,
  });
  const currentQuestion = promptQuestion(retryAnchor, savedAnswer, session?.question);
  const isUnsentTurn = session !== undefined && savedAnswer === null && Boolean(transcript);

  return (
    <div className="coach-workspace flex flex-col gap-6">
      <header className="coach-header">
        <p className="eyebrow">PRACTICE / COACH</p>
        <h1>Focused feedback &amp; Try Again</h1>
        <p className="intro">
          Review focused feedback on your saved answer, hear a stronger B2 phrasing, and speak it
          again to build active fluency.
        </p>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5 text-xs text-slate-300">
          <span className="font-semibold text-teal-300 mr-1">Coach loop:</span>
          <span className={stepBadgeClass(currentStep === 1)}>1. Speak</span>
          <span className="text-slate-500" aria-hidden="true">
            →
          </span>
          <span className={stepBadgeClass(currentStep === 2)}>2. Save answer</span>
          <span className="text-slate-500" aria-hidden="true">
            →
          </span>
          <span className={stepBadgeClass(currentStep === 3)}>3. Focused feedback</span>
          <span className="text-slate-500" aria-hidden="true">
            →
          </span>
          <span className={stepBadgeClass(currentStep === 4)}>4. Try Again</span>
          <span className="text-slate-500" aria-hidden="true">
            →
          </span>
          <span className={stepBadgeClass(currentStep === 5)}>5. Compare attempts</span>
        </div>
      </header>

      {session === undefined && (
        <Card className="panel" variant="secondary">
          <Card.Header className="panel-header">
            <div>
              <p className="section-kicker">DAILY PRACTICE</p>
              <Card.Title className="section-title">No conversation in progress</Card.Title>
            </div>
          </Card.Header>
          <Card.Content className="panel-content">
            <p className="text-sm text-slate-300 leading-relaxed m-0">
              Coach provides focused feedback and re-speaking for answers in your active
              conversation. Start daily practice to begin.
            </p>
            <Button
              className="primary-action mt-4"
              isDisabled={model.busy}
              onPress={actions.startPractice}
              variant="primary"
            >
              Start daily practice
            </Button>
          </Card.Content>
        </Card>
      )}

      {session !== undefined && (
        <div className="flex flex-col gap-6">
          <Card className="panel" variant="secondary">
            <Card.Header className="panel-header flex items-center justify-between">
              <div>
                <p className="section-kicker">
                  {isRetrying
                    ? 'RE-SPEAKING PROMPT'
                    : `COACH PROMPT · TURN ${savedAnswer?.sequence ?? session.turnCount + 1}`}
                </p>
                <Card.Title className="prompt-title">{currentQuestion}</Card.Title>
              </div>
              <Button
                className="secondary-action text-xs"
                onPress={() => speech.play(currentQuestion)}
                variant="secondary"
              >
                Hear question
              </Button>
            </Card.Header>
          </Card>

          {isUnsentTurn && !isRetrying && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5">
              <p className="section-kicker text-amber-300">SAVED ANSWER REQUIRED</p>
              <p className="text-sm font-semibold text-amber-100 mt-1 mb-0">
                Send your answer to Eva to save this turn before reviewing feedback.
              </p>
              <p className="text-xs text-amber-200/80 mt-1 mb-4 leading-relaxed">
                Feedback evaluation and Try Again are linked to saved conversation turns. Send it
                through the Conversation flow, then return here for focused review.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="primary-action text-xs"
                  onPress={onNavigateToConversation}
                  variant="primary"
                >
                  Go to Conversation to send →
                </Button>
              </div>
            </div>
          )}

          {savedAnswer && (
            <Card className="panel" variant="secondary">
              <Card.Header className="panel-header">
                <div>
                  <p className="section-kicker">FIRST ATTEMPT · TURN {savedAnswer.sequence}</p>
                  <Card.Title className="section-title">Your saved answer</Card.Title>
                </div>
              </Card.Header>
              <Card.Content className="panel-content">
                <p className="transcript-text">{savedAnswer.originalTranscript}</p>
              </Card.Content>
            </Card>
          )}

          <PracticeControls
            actions={actions}
            isRetrying={isRetrying}
            model={model}
            retryPrompt={retryAnchor?.feedback.b2_rewrite}
            surface="coach"
          />

          <PracticeFeedbackArea
            isCurrent={isCurrent}
            isRetrying={isRetrying}
            onRetryAnchor={onRetryAnchor}
            onTryAgain={onTryAgain}
            recallActive={false}
            requestId={currentRequestId}
            retryAnchor={retryAnchor}
            savedAnswer={savedAnswer}
            session={session}
            transcript={savedAnswer?.originalTranscript ?? transcript}
          />

          {isRetrying && retryAnchor && (
            <div className="flex flex-col gap-3">
              <RetryComparisonPanel
                attemptId={currentRequestId}
                key={`retry-${retryAnchor.requestId}`}
                onCompare={(retryTranscript) =>
                  retryPracticeTurn(retryAnchor.sessionId, retryAnchor.sequence, retryTranscript)
                }
                onContinue={onContinueFromRetry}
                onSaved={(comparison) =>
                  actions.handleRetryComparison(retryAnchor.sessionId, comparison)
                }
                original={retryAnchor.originalTranscript}
                retry={transcript}
              />
              <Button
                className="secondary-action w-fit text-xs self-start"
                onPress={onCancelRetry}
                variant="secondary"
              >
                Back to review
              </Button>
            </div>
          )}

          {session.retryEvidence.map((evidence) => (
            <article className="panel p-5" key={`saved-retry-${evidence.turn_sequence}`}>
              <p className="section-kicker">SAVED TRY AGAIN · TURN {evidence.turn_sequence}</p>
              <p className="m-0 text-sm text-slate-300">
                Target wording evidence: {evidence.target_evidence.replace(/_/g, ' ')} · Hesitation:{' '}
                {evidence.hesitation}
              </p>
              <p className="mt-2 mb-0 text-xs text-slate-400">
                Original: {evidence.original_transcript}
              </p>
              <p className="mt-1 mb-0 text-xs text-slate-400">Retry: {evidence.retry_transcript}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
