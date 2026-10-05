import { Button } from '@heroui/react';
import { DialogueStream } from '@/features/practice/DialogueStream';
import type { InputSource } from '@/features/practice/lib/inputSource';
import type { SessionDetails } from '@/features/practice/lib/practiceState';
import { coachPromptQuestion } from '@/features/practice/lib/practiceViewState';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import { PracticeChatComposer } from '@/features/practice/PracticeChatComposer';
import { PracticeControls } from '@/features/practice/PracticeControls';
import { PracticeFeedbackArea } from '@/features/practice/PracticeFeedbackArea';
import type { PracticeActions, PracticeViewModel } from '@/features/practice/practiceViewModel';
import { retryPracticeTurn } from '@/features/practice/sessionApi';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import type { TurnFeedback } from '@/lib/types';
import { deriveCoachStep } from './lib/coachState';
import { RetryComparisonPanel } from './RetryComparisonPanel';
import { SavedRetryEvidence } from './SavedRetryEvidence';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  session?: SessionDetails;
  savedAnswer: SentAnswer | null;
  retryAnchor: (SentAnswer & { feedback: TurnFeedback }) | null;
  isRetrying: boolean;
  isCurrent: () => boolean;
  sendError: string;
  historyError: string;
  retryHistory: () => void;
  dialogue: PracticeDialogue | null;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onRetryAnchor: (answer: SentAnswer & { feedback: TurnFeedback }) => void;
  onTryAgain: () => void;
  onCancelRetry: () => void;
  onContinueFromRetry: () => void;
  onContinueCoach: () => void;
  isContinuingCoach: boolean;
  continueError: string;
};

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
  dialogue,
  sendError,
  historyError,
  retryHistory,
  onSend,
  onRetryAnchor,
  onTryAgain,
  onCancelRetry,
  onContinueFromRetry,
  onContinueCoach,
  isContinuingCoach,
  continueError,
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
  const currentQuestion = coachPromptQuestion(retryAnchor, savedAnswer, session, isRetrying);
  const isCoachPending = session?.mode === 'coach' && session.coachState?.is_pending === true;

  return (
    <div className="practice-chat-layout">
      <header className="practice-compact-header">
        <div className="practice-compact-header-left">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
              Coach · Focused practice
            </span>
          </div>
          <h1 className="practice-compact-title">
            {currentQuestion ?? 'Focused feedback & Try Again'}
          </h1>
          <div className="coach-stepper mt-1">
            <StepPill currentStep={currentStep} stepNumber={1} title="Speak" />
            <span aria-hidden="true" className="stepper-arrow">
              →
            </span>
            <StepPill currentStep={currentStep} stepNumber={2} title="Save" />
            <span aria-hidden="true" className="stepper-arrow">
              →
            </span>
            <StepPill currentStep={currentStep} stepNumber={3} title="Feedback" />
            <span aria-hidden="true" className="stepper-arrow">
              →
            </span>
            <StepPill currentStep={currentStep} stepNumber={4} title="Try Again" />
            <span aria-hidden="true" className="stepper-arrow">
              →
            </span>
            <StepPill currentStep={currentStep} stepNumber={5} title="Compare" />
          </div>
        </div>

        <div className="practice-compact-header-right">
          {session ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                {session.turnCount} / {session.targetTurns} answers
              </span>
              <Button
                className="secondary-action text-xs"
                isDisabled={
                  model.busy || !model.canChangeSession || model.practice.tag !== 'active'
                }
                onPress={actions.finishPractice}
                size="sm"
              >
                {model.practice.tag === 'finishing' ? 'Finishing…' : 'Finish'}
              </Button>
            </div>
          ) : (
            <Button
              className="primary-action text-xs"
              isDisabled={model.busy}
              onPress={() => actions.startPractice('coach')}
              size="sm"
            >
              Start Coach
            </Button>
          )}
        </div>
      </header>

      {session === undefined && (
        <div className="coach-card m-4">
          <div className="flex flex-col gap-2">
            <p className="section-kicker">COACH PRACTICE</p>
            <h2 className="text-xl font-bold text-zinc-100">No conversation in progress</h2>
            <p className="m-0 text-sm leading-relaxed text-zinc-400">
              Start a dedicated four answer Coach session. Your first answer is saved for review
              before Eva asks the next question.
            </p>
          </div>
          <div className="pt-2">
            <Button
              className="primary-action"
              isDisabled={model.busy}
              onPress={() => actions.startPractice('coach')}
            >
              Start Coach practice
            </Button>
          </div>
        </div>
      )}

      {session !== undefined && (
        <DialogueStream
          currentQuestion={currentQuestion}
          dialogue={dialogue}
          historyError={historyError}
          retryHistory={retryHistory}
          onPlaySpeech={speech.play}
        >
          {isCoachPending && (
            <div className="coach-card my-3">
              <p className="m-0 text-sm text-zinc-300">
                Your answer is saved. Review the feedback, try again if you want, or continue when
                you are ready. Coach comparisons use transcript wording only.
              </p>
              <div className="flex flex-wrap gap-2 pt-3">
                <Button
                  className="primary-action"
                  isDisabled={
                    isContinuingCoach ||
                    model.busy ||
                    !model.canChangeSession ||
                    model.practice.tag !== 'active'
                  }
                  onPress={onContinueCoach}
                >
                  {isContinuingCoach ? 'Getting next prompt…' : 'Continue to next prompt'}
                </Button>
              </div>
              {continueError && (
                <p className="error-message" role="alert">
                  {continueError}
                </p>
              )}
            </div>
          )}

          <PracticeFeedbackArea
            isCurrent={isCurrent}
            isRetrying={isRetrying}
            onPersistFeedback={actions.saveFeedback}
            onRetryAnchor={onRetryAnchor}
            onSpeakRewrite={speech.play}
            onTryAgain={onTryAgain}
            recallActive={false}
            requestId={currentRequestId}
            retryAnchor={retryAnchor}
            savedAnswer={savedAnswer}
            session={session}
            transcript={savedAnswer?.originalTranscript ?? transcript}
          />

          {isRetrying && retryAnchor && (
            <div className="flex flex-col gap-4 my-3">
              <PracticeControls
                actions={actions}
                isRetrying={isRetrying}
                model={model}
                retryPrompt={retryAnchor.feedback.b2_rewrite}
                surface="coach"
              />
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

          <SavedRetryEvidence evidence={session.retryEvidence} />

          {session.mode === 'coach' && session.turnCount >= session.targetTurns && (
            <p className="coach-card my-3 text-sm text-zinc-300">
              You reached the four answer Coach goal. You can finish now or keep practicing.
            </p>
          )}

          <details className="chat-collapsible-diagnostics my-3">
            <summary className="chat-collapsible-summary">Audio &amp; Voice Settings</summary>
            <div className="flex flex-col gap-4 p-4 border border-white/8 rounded-xl bg-black/30 mt-2">
              <SpeechPanel speech={speech} transcript={model.transcript} />
              <TimingPanel timing={model.timing} />
            </div>
          </details>
        </DialogueStream>
      )}

      <PracticeChatComposer
        answerSequence={session ? session.turnCount + 1 : undefined}
        busy={model.busy || model.practice.tag !== 'active'}
        currentRequestId={model.currentRequestId}
        disabled={session === undefined || isCoachPending || isRetrying}
        disabledReason={
          session === undefined
            ? 'Start a Coach session above to begin.'
            : isRetrying
              ? 'Re-speaking in progress. Record your retry above.'
              : isCoachPending
                ? 'Your answer is saved. Review feedback above, or click Continue to get the next prompt.'
                : undefined
        }
        errorMessage={sendError || model.error || model.transcriptionFailure?.message}
        isRecording={model.status === 'recording'}
        isRetrying={isRetrying}
        onSend={onSend}
        onStartRecording={actions.startRecording}
        onStopRecording={actions.stopRecording}
        question={currentQuestion}
        sessionId={session?.sessionId}
        transcript={model.transcript}
        transcribing={model.transcribing}
      />
    </div>
  );
}
