import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import type { HelpLevel } from '../helpers/help-levels';
import type { PlanningSeconds } from '../types';
import {
  helpLevelAtom,
  helpNoticeAtom,
  isRecordingAtom,
  planAtom,
  planningTimerAtom,
  remainingSecondsAtom,
} from './atoms';
import { answerHelpEffectsAtom, helpSurfaceAtom } from './effects';
import { changeHelpLevel } from './help-level';
import { retryPlan } from './plan';
import { cancelPlanning, planningGuardAtom, startPlanning } from './planning';

export function useAnswerHelpEffects() {
  useAtomMount(answerHelpEffectsAtom);
}

export function useAnswerHelp(isDisabled: boolean) {
  const registry = useContext(RegistryContext);
  useAtomMount(helpSurfaceAtom);
  useAtomMount(planningGuardAtom(isDisabled));
  return {
    level: useAtomValue(helpLevelAtom),
    notice: useAtomValue(helpNoticeAtom),
    plan: useAtomValue(planAtom),
    isRecording: useAtomValue(isRecordingAtom),
    isPlanning: useAtomValue(planningTimerAtom) !== null,
    remainingSeconds: useAtomValue(remainingSecondsAtom),
    choose: (level: HelpLevel | null) => changeHelpLevel(registry, level),
    retry: () => retryPlan(registry),
    startPlanning: (seconds: PlanningSeconds) => startPlanning(registry, seconds),
    cancelPlanning: () => cancelPlanning(registry),
  };
}
