import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { InputSource } from '@/features/practice/lib/inputSource';
import type { SessionDetails } from '@/features/practice/lib/practiceState';
import { coachPromptQuestion } from '@/features/practice/lib/practiceViewState';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import type { SendFailure } from '@/features/practice/lib/turnIssue';
import { ManualRecorder } from '@/features/practice/ManualRecorder';
import { NoSession } from '@/features/practice/NoSession';
import { PracticeFeedbackArea } from '@/features/practice/PracticeFeedbackArea';
import type { PracticeActions, PracticeViewModel } from '@/features/practice/practiceViewModel';
import { retryPracticeTurn } from '@/features/practice/sessionApi';
import { TalkScreen, type TalkScreenName } from '@/features/practice/TalkScreen';
import { TurnNotice } from '@/features/practice/TurnNotice';
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
  sendError?: SendFailure;
  historyError: string;
  retryHistory: () => void;
  pendingReply?: string;
  dialogue: PracticeDialogue | null;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onNavigate?: (screen: TalkScreenName) => void;
  onRetryAnchor: (answer: SentAnswer & { feedback: TurnFeedback }) => void;
  onTryAgain: () => void;
  onCancelRetry: () => void;
  onContinueFromRetry: () => void;
  onContinueCoach: () => void;
  isContinuingCoach: boolean;
  continueError: string;
};

const STEP_TITLES = ['Speak', 'Save', 'Feedback', 'Try again', 'Compare'];

function lockReason(isRetrying: boolean, isCoachPending: boolean): string | undefined {
  if (isRetrying) return 'Re-speaking in progress. Record your retry above.';
  if (isCoachPending) {
    return 'Your answer is saved. Review feedback above, or continue to the next prompt.';
  }
  return undefined;
}

type ExtrasProps = Props & {
  session: SessionDetails;
  isCoachPending: boolean;
  onPhraseSaved: () => void;
  onPhraseSaveUndone: () => void;
};

function RetryExtras(props: ExtrasProps) {
  const { model, actions, retryAnchor, session } = props;
  if (!props.isRetrying || !retryAnchor) return null;
  return (
    <>
      <ManualRecorder
        actions={actions}
        cue={retryAnchor.feedback.b2_rewrite}
        isRetrying
        kicker="Say it again"
        model={model}
        surface="retry"
      />
      <RetryComparisonPanel
        attemptId={model.currentRequestId}
        key={`retry-${retryAnchor.requestId}`}
        onCompare={(retryTranscript) =>
          retryPracticeTurn(retryAnchor.sessionId, retryAnchor.sequence, retryTranscript)
        }
        onContinue={props.onContinueFromRetry}
        onSaved={(comparison) => actions.handleRetryComparison(retryAnchor.sessionId, comparison)}
        original={retryAnchor.originalTranscript}
        retry={model.transcript}
      />
      <div className="talk-card-actions">
        <Button onPress={props.onCancelRetry} size="sm" variant="ghost">
          Back to review
        </Button>
      </div>
      <SavedRetryEvidence
        evidence={session.retryEvidence.filter(
          (evidence) => evidence.turn_sequence !== retryAnchor.sequence,
        )}
      />
    </>
  );
}

function ContinueRow(props: ExtrasProps) {
  const { model } = props;
  return (
    <div className="talk-aside">
      <p className="talk-quiet-note">
        Your answer is saved. Review the feedback, say it again if you want, or continue when you
        are ready. Coach comparisons use transcript wording only.
      </p>
      <Button
        isDisabled={
          props.isContinuingCoach ||
          model.busy ||
          !model.canChangeSession ||
          model.practice.tag !== 'active'
        }
        onPress={props.onContinueCoach}
        size="sm"
        variant="ghost"
      >
        {props.isContinuingCoach ? 'Getting next prompt…' : 'Continue to next prompt'}
        <ArrowRight aria-hidden="true" size={14} />
      </Button>
      {props.continueError && <TurnNotice message={props.continueError} />}
    </div>
  );
}

function CoachExtras(props: ExtrasProps) {
  const { model, actions, speech, session, savedAnswer, retryAnchor } = props;
  return (
    <>
      <PracticeFeedbackArea
        isCurrent={props.isCurrent}
        isRetrying={props.isRetrying}
        onPersistFeedback={actions.saveFeedback}
        onPhraseSaved={props.onPhraseSaved}
        onPhraseSaveUndone={props.onPhraseSaveUndone}
        onRetryAnchor={props.onRetryAnchor}
        onSpeakRewrite={speech.play}
        onTryAgain={props.onTryAgain}
        recallActive={false}
        requestId={model.currentRequestId}
        retryAnchor={retryAnchor}
        savedAnswer={savedAnswer}
        session={session}
        transcript={savedAnswer?.originalTranscript ?? model.transcript}
      />
      <RetryExtras {...props} />
      {!props.isRetrying && <SavedRetryEvidence evidence={session.retryEvidence} />}
      {props.isCoachPending && <ContinueRow {...props} />}
      {session.mode === 'coach' && session.turnCount >= session.targetTurns && (
        <p className="talk-quiet-note">
          You reached the four answer Coach goal. You can finish now or keep practicing.
        </p>
      )}
    </>
  );
}

export function CoachWorkspace(props: Props) {
  const { model, actions, session, savedAnswer, retryAnchor, isRetrying } = props;
  const [phraseSavedRequestId, setPhraseSavedRequestId] = useState<number | null>(null);
  if (!session) {
    return (
      <NoSession
        actionLabel="Start Coach practice"
        isDisabled={model.busy}
        onStart={() => actions.startPractice('coach')}
        text="Start a dedicated four answer Coach session. Your first answer is saved for review before Eva asks the next question."
        title="No conversation in progress"
      />
    );
  }

  const step = deriveCoachStep({
    hasSession: true,
    hasTranscript: Boolean(model.transcript),
    savedAnswer,
    retryAnchor,
    isRetrying,
    hasComparison: session.retryEvidence.some(
      (evidence) => evidence.turn_sequence === retryAnchor?.sequence,
    ),
  });
  const isCoachPending = session.mode === 'coach' && session.coachState?.is_pending === true;

  return (
    <TalkScreen
      actions={actions}
      coachStep={STEP_TITLES[step - 1]}
      dialogue={props.dialogue}
      historyError={props.historyError}
      isContinuing={props.isContinuingCoach}
      isFinishDisabled={model.busy || !model.canChangeSession || model.practice.tag !== 'active'}
      isPhraseSaved={phraseSavedRequestId === model.currentRequestId}
      isRetrying={isRetrying}
      lock={{
        isLocked: isCoachPending || isRetrying,
        reason: lockReason(isRetrying, isCoachPending),
      }}
      mode="coach"
      model={model}
      onNavigate={props.onNavigate}
      onSend={props.onSend}
      pendingReply={props.pendingReply}
      question={coachPromptQuestion(retryAnchor, savedAnswer, session, isRetrying)}
      retryHistory={props.retryHistory}
      sendError={props.sendError}
      session={session}
      speech={props.speech}
    >
      <CoachExtras
        {...props}
        isCoachPending={isCoachPending}
        onPhraseSaved={() => setPhraseSavedRequestId(model.currentRequestId)}
        onPhraseSaveUndone={() => {
          // The closure belongs to the answer that was saved; a later answer's state stays.
          const savedRequestId = model.currentRequestId;
          setPhraseSavedRequestId((current) => (current === savedRequestId ? null : current));
        }}
        session={session}
      />
    </TalkScreen>
  );
}
