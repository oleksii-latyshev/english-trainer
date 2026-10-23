import type { SessionDetails } from '@/core/practice-session';
import type { SentAnswer } from '@/core/practice-turn';
import { DailyRecallPanel } from '@/features/practice/DailyRecallPanel';
import { ManualRecorder } from '@/features/practice/ManualRecorder';
import { MemoryUsageReview } from '@/features/practice/MemoryUsageReview';
import type { PracticeActions, PracticeViewModel } from '@/features/practice/practiceViewModel';
import type { useDailyRecall } from '@/features/practice/useDailyRecall';
import type { PracticeDialogue } from '@/lib/dialogueTypes';

type Props = {
  session: SessionDetails;
  model: PracticeViewModel;
  actions: PracticeActions;
  recall: ReturnType<typeof useDailyRecall>;
  isRetrying: boolean;
  dialogue: PracticeDialogue | null;
  sentAnswer: SentAnswer | null;
};

function RecallExtras({ session, model, actions, recall, isRetrying }: Props) {
  if (session.isMistakePractice) return null;
  if (session.practiceMode !== 'voice' || session.practicePhase !== 'speaking') return null;
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

function shouldReviewUsage({ session, sentAnswer, dialogue, isRetrying, recall }: Props) {
  if (session.isMistakePractice || session.practiceMode !== 'voice' || sentAnswer === null) {
    return false;
  }
  const index = sentAnswer.sequence - 1;
  return (
    sentAnswer.sequence <= 2 &&
    dialogue?.input_sources?.[index] === 'voice' &&
    dialogue?.help_used?.[index] !== true &&
    !isRetrying &&
    !recall.active
  );
}

export function TalkExtras(props: Props) {
  const { sentAnswer } = props;
  return (
    <>
      <RecallExtras {...props} />
      {sentAnswer !== null && shouldReviewUsage(props) && (
        <MemoryUsageReview sequence={sentAnswer.sequence} sessionId={sentAnswer.sessionId} />
      )}
    </>
  );
}
