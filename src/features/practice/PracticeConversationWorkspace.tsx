import { Button } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { MemoryUsageReview } from '@/features/memory/components/MemoryUsageReview';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { DailyRecallPanel } from './DailyRecallPanel';
import type { InputSource } from './lib/inputSource';
import type { SessionDetails } from './lib/practiceState';
import type { SentAnswer } from './lib/sentAnswer';
import type { SendFailure } from './lib/turnState';
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
  onSend: (text: string, source: InputSource) => Promise<void>;
  onNavigate?: (screen: TalkScreenName) => void;
};

type ExtrasProps = Pick<
  Props,
  'model' | 'actions' | 'recall' | 'isRetrying' | 'savedAnswer' | 'dialogue' | 'onNavigate'
> & { session: SessionDetails };

function RecallExtras({ model, actions, recall, isRetrying, session }: ExtrasProps) {
  const canUseRecall = session.mode === 'conversation' && session.turnCount >= session.targetTurns;
  if (!canUseRecall) return null;
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

function CoachGateway({ model, onNavigate }: Pick<ExtrasProps, 'model' | 'onNavigate'>) {
  return (
    <div className="talk-aside">
      <Button
        isDisabled={model.busy || !model.canChangeSession || model.practice.tag !== 'active'}
        onPress={() => onNavigate?.('coach')}
        size="sm"
        variant="ghost"
      >
        Get feedback in Coach
        <ArrowRight aria-hidden="true" size={14} />
      </Button>
    </div>
  );
}

function ConversationExtras(props: ExtrasProps) {
  const { model, recall, isRetrying, savedAnswer, dialogue, session } = props;
  const showUsageReview =
    session.mode === 'conversation' &&
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
      {(savedAnswer || model.transcript) && (
        <CoachGateway model={model} onNavigate={props.onNavigate} />
      )}
    </>
  );
}

export function PracticeConversationWorkspace(props: Props) {
  const { model, actions, session, recall, isRetrying } = props;
  if (!session) {
    return (
      <NoSession
        actionLabel="Start practice"
        isDisabled={model.busy}
        onStart={() => actions.startPractice('conversation')}
        text="Start a conversation with Eva to begin."
        title="Your voice, in English."
      />
    );
  }

  return (
    <TalkScreen
      dialogue={props.dialogue}
      historyError={props.historyError}
      isFinishDisabled={
        model.busy || !model.canChangeSession || model.practice.tag !== 'active' || recall.active
      }
      isRecalling={recall.active}
      isRetrying={isRetrying}
      lock={{
        isLocked: recall.active || isRetrying,
        reason: recall.active ? 'Spoken phrase recall is in progress above.' : undefined,
      }}
      mode="conversation"
      actions={actions}
      model={model}
      onNavigate={props.onNavigate}
      onSend={props.onSend}
      pendingReply={props.pendingReply}
      question={session.question}
      retryHistory={props.retryHistory}
      sendError={props.sendError}
      session={session}
      speech={props.speech}
    >
      <ConversationExtras {...props} session={session} />
    </TalkScreen>
  );
}
