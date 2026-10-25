import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useContext } from 'react';
import {
  canSendPracticeStage,
  practiceKeepsMicrophoneWarm,
  practiceStageIsWriting,
  type SessionDetails,
  sessionDetails,
  startPracticeAtom,
} from '@/core/practice-session';
import { acceptedAnswerAtom } from '@/core/practice-turn';
import { useSpeech } from '@/core/speech';
import { AnswerHelp, helpLevelAtom, useAnswerHelpEffects } from '@/features/answer-help';
import { cancelSayAgain, sayAgainActiveAtom } from '@/features/coaching-note';
import { OriginalQuestionPrompt } from '@/features/practice/OriginalQuestionPrompt';
import { PracticeReview } from '@/features/practice/PracticeReview';
import { RescuePanel } from '@/features/practice/RescuePanel';
import { recallActiveAtom } from '@/features/spoken-recall';
import { useTurn } from '@/features/talk-composer';
import { HISTORY_FAILED_MESSAGE, useDialogue } from '@/features/talk-dialogue';
import { isPracticeDialogue } from '@/lib/dialogueTypes';
import { TalkScreen } from '@/screens/talk';
import { rescueCaptureOf } from './rescue-capture';
import { TalkExtras } from './talk-extras';
import { usePracticeActions, usePracticeModel } from './use-practice-model';
import { useCancelOnStageChange, useTurnLock } from './use-turn-lock';
import '@/features/practice/talkCards.css';
import '@/features/practice/talkComposer.css';
import '@/features/practice/talkDialogue.css';
import '@/features/practice/talkStage.css';

function lockReason(
  isRecalling: boolean,
  isRetrying: boolean,
  isStageLocked: boolean,
  isMistakePractice: boolean,
): string | undefined {
  if (isRecalling) return 'Spoken phrase recall is in progress above.';
  if (isRetrying) return 'Re-speaking in progress. Finish or cancel it in the review.';
  if (!isStageLocked) return undefined;
  return isMistakePractice
    ? 'Practice complete. Finish when you are ready.'
    : 'All original questions have been answered. Review this stage to continue.';
}

function canHelp(session: SessionDetails | undefined, isOccupied: boolean): boolean {
  if (session === undefined || !practiceKeepsMicrophoneWarm(session)) return false;
  if (session.isMistakePractice || practiceStageIsWriting(session)) return false;
  return session.question !== '' && !isOccupied;
}

function hasRescue(session: SessionDetails): boolean {
  if (session.isMistakePractice || session.practiceMode === 'text_chat') return false;
  return session.practiceMode !== 'write_then_speak' || session.practicePhase === 'speaking';
}

function useVoiceAvailability() {
  useSpeech();
}

export function TalkRoute() {
  useVoiceAvailability();
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const model = usePracticeModel();
  const session = sessionDetails(model.practice);
  const turn = useTurn();
  const history = useDialogue();
  const dialogue = isPracticeDialogue(history.dialogue) ? history.dialogue : null;
  const isRecalling = useAtomValue(recallActiveAtom);
  const isRetrying = useAtomValue(sayAgainActiveAtom);
  const actions = usePracticeActions();

  useTurnLock(registry, isRecalling || isRetrying);
  useCancelOnStageChange(session, () => cancelSayAgain(registry));

  const isHelpAvailable = canHelp(session, isRetrying || isRecalling);
  useAnswerHelpEffects();
  const isHelpOpen = useAtomValue(helpLevelAtom) !== null;
  const accepted = useAtomValue(acceptedAnswerAtom);

  const isStageLocked = session !== undefined && !canSendPracticeStage(session);
  const isHelpDisabled = [
    model.busy,
    model.practice.tag !== 'active',
    turn.isSending,
    model.transcribing,
    isRecalling,
    isRetrying,
    isStageLocked,
  ].some(Boolean);

  const helpBar: ReactNode =
    isHelpAvailable && session ? <AnswerHelp isDisabled={isHelpDisabled} /> : undefined;

  const rescueControl: ReactNode =
    isHelpAvailable && session && hasRescue(session) && model.status === 'recording' ? (
      <RescuePanel
        capture={rescueCaptureOf(registry)}
        key={`${session.sessionId}:${session.practicePhase}:${session.turnCount + 1}:${session.question}:${model.currentRequestId}`}
        phase={session.practicePhase}
        question={session.question}
        recordingId={model.currentRequestId}
        sequence={session.turnCount + 1}
        sessionId={session.sessionId}
      />
    ) : undefined;

  const extras: ReactNode = session ? (
    <TalkExtras
      accepted={accepted}
      dialogue={dialogue}
      isRecalling={isRecalling}
      isRetrying={isRetrying}
      session={session}
    />
  ) : undefined;

  const reviewStage: ReactNode = session ? (
    <PracticeReview
      actions={actions}
      dialogue={dialogue}
      historyError={history.hasFailed ? HISTORY_FAILED_MESSAGE : ''}
      model={model}
      onRetryHistory={history.retry}
      session={session}
    />
  ) : undefined;

  const replayPrompt: ReactNode = session ? (
    <OriginalQuestionPrompt
      isComplete={session.spokenTurnCount >= session.writtenTurnCount}
      question={session.question}
      spokenTurnCount={session.spokenTurnCount}
      writtenTurnCount={session.writtenTurnCount}
    />
  ) : undefined;

  return (
    <TalkScreen
      dialogueExtras={extras}
      helpBar={helpBar}
      isFinishBlocked={isRecalling}
      lockedReason={
        session
          ? lockReason(isRecalling, isRetrying, isStageLocked, session.isMistakePractice)
          : undefined
      }
      moodExtras={{ isHelpOpen }}
      onChooseMicrophone={() => void navigate({ to: '/settings', hash: 'microphone' })}
      onOpenSettings={() => void navigate({ to: '/settings' })}
      onStartPractice={() => registry.set(startPracticeAtom, undefined)}
      replayPrompt={replayPrompt}
      rescueControl={rescueControl}
      reviewStage={reviewStage}
    />
  );
}
