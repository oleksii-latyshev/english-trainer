import { MemoryUsageReview } from '@/features/memory/components/MemoryUsageReview';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import type { NoteTools } from './AnswerNote';
import { DailyRecallPanel } from './DailyRecallPanel';
import type { InputSource } from './lib/inputSource';
import type { SessionDetails } from './lib/practiceState';
import type { SentAnswer } from './lib/sentAnswer';
import type { SendFailure } from './lib/turnIssue';
import { ManualRecorder } from './ManualRecorder';
import { NoSession } from './NoSession';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { TalkScreen, type TalkScreenName } from './TalkScreen';
import type { useDailyRecall } from './useDailyRecall';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  session?: SessionDetails;
  recall: ReturnType<typeof useDailyRecall>;
  isRetrying: boolean;
  sendError?: SendFailure;
  historyError: string;
  retryHistory: () => void;
  pendingReply?: string;
  savedAnswer: SentAnswer | null;
  dialogue: PracticeDialogue | null;
  noteTools: NoteTools | null;
  isPhraseSaved: boolean;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onNavigate?: (screen: TalkScreenName) => void;
};

type ExtrasProps = Pick<
  Props,
  'model' | 'actions' | 'recall' | 'isRetrying' | 'savedAnswer' | 'dialogue'
> & { session: SessionDetails };

function RecallExtras({ model, actions, recall, isRetrying, session }: ExtrasProps) {
  if (session.turnCount < session.targetTurns) return null;
  return (
    <>
      {recall.active && (
        <ManualRecorder
          actions={actions}
          cue={recall.currentItem?.cue ?? 'Review your saved recall below.'}
          isLocked={recall.saving || recall.result !== null}
          kicker="Phrase recall cue"
          model={model}
          surface="recall"
        />
      )}
      <DailyRecallPanel
        canLeave={model.canChangeSession}
        canStart={
          model.canChangeSession && !model.busy && !isRetrying && model.practice.tag === 'active'
        }
        recall={{
          ...recall,
          start: () => {
            actions.resetCapture();
            recall.start();
          },
        }}
        resetCapture={actions.resetCapture}
        transcript={model.transcript}
      />
    </>
  );
}

function TalkExtras(props: ExtrasProps) {
  const { recall, isRetrying, savedAnswer, dialogue } = props;
  const showUsageReview =
    savedAnswer !== null &&
    savedAnswer.sequence <= 2 &&
    dialogue?.input_sources?.[savedAnswer.sequence - 1] === 'voice' &&
    !isRetrying &&
    !recall.active;
  return (
    <>
      <RecallExtras {...props} />
      {showUsageReview && (
        <MemoryUsageReview sequence={savedAnswer.sequence} sessionId={savedAnswer.sessionId} />
      )}
    </>
  );
}

/** The one Talk screen: Eva's replies with a coaching note under each of the learner's answers. */
export function TalkWorkspace(props: Props) {
  const { model, actions, session, recall, isRetrying } = props;
  if (!session) {
    return (
      <NoSession
        actionLabel="Start practice"
        isDisabled={model.busy}
        onStart={() => actions.startPractice()}
        text="Start a conversation with Eva to begin."
        title="Your voice, in English."
      />
    );
  }

  return (
    <TalkScreen
      actions={actions}
      dialogue={props.dialogue}
      historyError={props.historyError}
      isFinishDisabled={
        model.busy || !model.canChangeSession || model.practice.tag !== 'active' || recall.active
      }
      isPhraseSaved={props.isPhraseSaved}
      isRecalling={recall.active}
      isRetrying={isRetrying}
      lock={{
        isLocked: recall.active || isRetrying,
        reason: lockReason(recall.active, isRetrying),
      }}
      model={model}
      noteTools={props.noteTools}
      onNavigate={props.onNavigate}
      onSend={props.onSend}
      pendingReply={props.pendingReply}
      question={session.question}
      retryHistory={props.retryHistory}
      sendError={props.sendError}
      session={session}
      speech={props.speech}
    >
      <TalkExtras {...props} session={session} />
    </TalkScreen>
  );
}

function lockReason(isRecalling: boolean, isRetrying: boolean): string | undefined {
  if (isRecalling) return 'Spoken phrase recall is in progress above.';
  if (isRetrying) return 'Re-speaking in progress. Say it again in the note above, or cancel it.';
  return undefined;
}
