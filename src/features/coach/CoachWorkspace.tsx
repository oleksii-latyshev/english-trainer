import { Button } from '@heroui/react';
import type { ReactNode } from 'react';
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
  followUpPanel?: ReactNode;
  onRetryAnchor: (answer: SentAnswer & { feedback: TurnFeedback }) => void;
  onTryAgain: () => void;
  onCancelRetry: () => void;
  onContinueFromRetry: () => void;
};

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

function StepPill({
  stepNumber,
  title,
  currentStep,
}: {
  stepNumber: number;
  title: string;
  currentStep: number;
}) {
  const isDone = currentStep > stepNumber;
  const isActive = currentStep === stepNumber;
  return (
    <span
      className={`coach-step-pill ${
        isActive ? 'coach-step-pill--active' : isDone ? 'coach-step-pill--done' : ''
      }`}
    >
      <span className="opacity-70">{isDone ? '✓' : `${stepNumber}.`}</span>
      <span>{title}</span>
    </span>
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
  followUpPanel,
  onRetryAnchor,
  onTryAgain,
  onCancelRetry,
  onContinueFromRetry,
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

  return (
    <div className="coach-workspace">
      <header className="coach-header">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
            COACH GYM · DELIBERATE RE-SPEAKING
          </span>
        </div>
        <h1>Focused feedback &amp; Try Again</h1>
        <p className="intro">
          Review focused feedback on your saved answer, hear a stronger B2 phrasing, and speak it
          again to build active fluency.
        </p>

        <div className="coach-stepper mt-2">
          <StepPill currentStep={currentStep} stepNumber={1} title="Speak" />
          <span aria-hidden="true" className="stepper-arrow">
            →
          </span>
          <StepPill currentStep={currentStep} stepNumber={2} title="Save answer" />
          <span aria-hidden="true" className="stepper-arrow">
            →
          </span>
          <StepPill currentStep={currentStep} stepNumber={3} title="Focused feedback" />
          <span aria-hidden="true" className="stepper-arrow">
            →
          </span>
          <StepPill currentStep={currentStep} stepNumber={4} title="Try Again" />
          <span aria-hidden="true" className="stepper-arrow">
            →
          </span>
          <StepPill currentStep={currentStep} stepNumber={5} title="Compare" />
        </div>
      </header>

      {session === undefined && (
        <div className="coach-card">
          <div className="flex flex-col gap-2">
            <p className="section-kicker">DAILY PRACTICE</p>
            <h2 className="text-xl font-bold text-zinc-100">No conversation in progress</h2>
            <p className="m-0 text-sm leading-relaxed text-zinc-400">
              Coach provides focused feedback and re-speaking for answers in your active
              conversation. Start daily practice to begin.
            </p>
          </div>
          <div className="pt-2">
            <Button
              className="primary-action"
              isDisabled={model.busy}
              onPress={actions.startPractice}
            >
              Start daily practice
            </Button>
          </div>
        </div>
      )}

      {session !== undefined && (
        <div className="flex flex-col gap-6">
          <div className="coach-card">
            <div className="prompt-card-header">
              <div>
                <p className="section-kicker">
                  {isRetrying
                    ? 'RE-SPEAKING PROMPT'
                    : `COACH PROMPT · TURN ${savedAnswer?.sequence ?? session.turnCount + 1}`}
                </p>
                <h2 className="prompt-title">{currentQuestion}</h2>
              </div>
              <Button
                className="secondary-action text-xs"
                onPress={() => speech.play(currentQuestion)}
              >
                Hear question ◖)
              </Button>
            </div>
          </div>

          {savedAnswer && (
            <div className="coach-card">
              <div>
                <p className="section-kicker">FIRST ATTEMPT · TURN {savedAnswer.sequence}</p>
                <h3 className="text-base font-semibold text-zinc-100">Your original answer</h3>
              </div>
              <p className="transcript-quote">“{savedAnswer.originalTranscript}”</p>
            </div>
          )}

          {followUpPanel}

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
            <div className="flex flex-col gap-4">
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
              <Button className="secondary-action w-fit text-xs self-start" onPress={onCancelRetry}>
                Back to review
              </Button>
            </div>
          )}

          {session.retryEvidence.map((evidence) => (
            <article className="coach-card" key={`saved-retry-${evidence.turn_sequence}`}>
              <div className="flex items-center justify-between">
                <p className="section-kicker">SAVED TRY AGAIN · TURN {evidence.turn_sequence}</p>
                <span className="metric-pill metric-pill--highlight">
                  Target Evidence: {evidence.target_evidence.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="comparison-grid">
                <div className="comparison-column">
                  <span className="comparison-label">Attempt 1</span>
                  <p className="comparison-text">“{evidence.original_transcript}”</p>
                </div>
                <div className="comparison-column comparison-column--retry">
                  <span className="comparison-label">Attempt 2 (Retry)</span>
                  <p className="comparison-text">“{evidence.retry_transcript}”</p>
                </div>
              </div>
              <p className="m-0 text-xs text-zinc-500">Hesitation: {evidence.hesitation}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
