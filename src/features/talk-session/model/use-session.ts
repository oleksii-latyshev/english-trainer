import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import {
  finishPracticeAtom,
  type PracticePhase,
  practiceErrorAtom,
  practiceStateAtom,
  transitionPhaseAtom,
} from '@/core/practice-session';
import { pauseMicrophone, resumeMicrophone } from '@/core/practice-turn';
import { sessionClockAtom } from './clock';

export function useSessionClock() {
  useAtomMount(sessionClockAtom);
}

export function useSessionCommands() {
  const registry = useContext(RegistryContext);
  return {
    finish: () => registry.set(finishPracticeAtom, undefined),
    transition: (phase: PracticePhase) => registry.set(transitionPhaseAtom, phase),
    pauseMicrophone: () => pauseMicrophone(registry),
    resumeMicrophone: () => resumeMicrophone(registry),
  };
}

export function useSessionState() {
  return {
    state: useAtomValue(practiceStateAtom),
    error: useAtomValue(practiceErrorAtom),
  };
}
