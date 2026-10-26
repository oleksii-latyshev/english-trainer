import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import { canSendPracticeStage, practiceStateAtom, sessionDetails } from '@/core/practice-session';
import { helpLevelAtom } from '@/features/answer-help';
import { cancelSayAgain, sayAgainActiveAtom } from '@/features/coaching-note';
import { recallActiveAtom } from '@/features/spoken-recall';
import { lockReason } from '../helpers/availability';
import { useCancelOnStageChange, useTurnLock } from './use-turn-lock';

export function useTalkGuards() {
  const registry = useContext(RegistryContext);
  const practice = useAtomValue(practiceStateAtom);
  const session = sessionDetails(practice);
  const isRecalling = useAtomValue(recallActiveAtom);
  const isRetrying = useAtomValue(sayAgainActiveAtom);
  const isHelpOpen = useAtomValue(helpLevelAtom) !== null;

  useTurnLock(registry, isRecalling || isRetrying);
  useCancelOnStageChange(session, () => cancelSayAgain(registry));

  const isStageLocked = session !== undefined && !canSendPracticeStage(session);
  return {
    isRecalling,
    isRetrying,
    isHelpOpen,
    isStageLocked,
    lockedReason: session
      ? lockReason(isRecalling, isRetrying, isStageLocked, session.isMistakePractice)
      : undefined,
  };
}

export type TalkGuards = ReturnType<typeof useTalkGuards>;
