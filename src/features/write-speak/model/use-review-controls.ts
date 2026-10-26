import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import { canChangeSessionAtom } from '@/core/answer-capture';
import {
  finishPracticeAtom,
  isSessionBusyAtom,
  practiceErrorAtom,
  practiceStateAtom,
  transitionPhaseAtom,
} from '@/core/practice-session';

export function useReviewControls(isLocked: boolean) {
  const registry = useContext(RegistryContext);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const isActive = useAtomValue(practiceStateAtom).tag === 'active';
  const error = useAtomValue(practiceErrorAtom);
  return {
    error,
    isDisabled: isBusy || !canChangeSession || !isActive || isLocked,
    finish: () => registry.set(finishPracticeAtom, undefined),
    readyToSpeak: () => registry.set(transitionPhaseAtom, 'speaking'),
  };
}
