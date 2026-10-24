import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import {
  canChangeSessionAtom,
  cancelListening,
  captureRequestIdAtom,
  captureStateAtom,
  captureTimingAtom,
  holdListening,
  resetCapture,
  startListening,
  stopListening,
  transcribeAgain,
} from '@/core/answer-capture';
import { microphoneSnapshotAtom } from '@/core/audio';
import {
  finishPracticeAtom,
  isSessionBusyAtom,
  practiceErrorAtom,
  practiceStateAtom,
  startPracticeAtom,
  transitionPhaseAtom,
} from '@/core/practice-session';
import { interruptReply, pauseMicrophone, resumeMicrophone } from '@/core/practice-turn';
import type { PracticeActions, PracticeViewModel } from '@/features/practice/practiceViewModel';
import { captureViewOf } from './capture-view';

const OFF = { status: 'off', error: '' } as const;

export function usePracticeModel(): PracticeViewModel {
  const capture = useAtomValue(captureStateAtom);
  const timing = useAtomValue(captureTimingAtom);
  const requestId = useAtomValue(captureRequestIdAtom);
  const microphone = AsyncResult.getOrElse(useAtomValue(microphoneSnapshotAtom), () => OFF);
  const practice = useAtomValue(practiceStateAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const view = captureViewOf(capture, timing, requestId, microphone);
  return {
    ...view,
    practice,
    practiceError: useAtomValue(practiceErrorAtom),
    busy: isBusy || view.status === 'requesting' || view.status === 'stopping',
    canChangeSession,
  };
}

export function usePracticeActions(): PracticeActions {
  const registry = useContext(RegistryContext);
  return {
    startRecording: () => interruptReply(registry, { record: true, retainPreRoll: false }),
    stopRecording: () => stopListening(registry),
    startAutoListen: () => startListening(registry, { mode: 'auto', discardPreRoll: false }),
    cancelRecording: () => cancelListening(registry),
    holdListening: (held) => holdListening(registry, held),
    pauseMic: () => pauseMicrophone(registry),
    resumeMic: () => resumeMicrophone(registry),
    transcribeRecording: () => transcribeAgain(registry),
    resetCapture: () => resetCapture(registry),
    startPractice: () => registry.set(startPracticeAtom, undefined),
    finishPractice: () => registry.set(finishPracticeAtom, undefined),
    transitionPracticePhase: (phase) => registry.set(transitionPhaseAtom, phase),
  };
}
