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
import { AnswerReview, cancelSayAgain, sayAgainActiveAtom } from '@/features/coaching-note';
import { Rescue } from '@/features/rescue';
import { recallActiveAtom } from '@/features/spoken-recall';
import { useTurn } from '@/features/talk-composer';
import { HISTORY_FAILED_MESSAGE, useDialogue } from '@/features/talk-dialogue';
import { OriginalQuestion, WriteSpeakReview } from '@/features/write-speak';
import { isPracticeDialogue } from '@/lib/dialogueTypes';
import { TalkScreen } from '@/screens/talk';
import { TalkExtras } from './talk-extras';
import { usePracticeModel } from './use-practice-model';
import { useCancelOnStageChange, useTurnLock } from './use-turn-lock';
import '@/features/practice/talkCards.css';
import '@/features/practice/talkDialogue.css';

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
      <Rescue />
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
    <WriteSpeakReview
      dialogue={dialogue}
      historyError={history.hasFailed ? HISTORY_FAILED_MESSAGE : ''}
      isLocked={isRetrying}
      onRetryHistory={history.retry}
      renderAnswerReview={(answer) => (
        <AnswerReview
          coaching={answer.coaching}
          target={{ sessionId: answer.sessionId, sequence: answer.sequence }}
          transcript={answer.transcript}
        />
      )}
      session={session}
    />
  ) : undefined;

  const replayPrompt: ReactNode = session ? (
    <OriginalQuestion
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
