import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import { isMicrophoneTestCapturing } from '../helpers/microphone-test';
import { clipPhaseAtom, microphoneTestAtom, microphoneTestRunAtom, stopClipAtom } from './atoms';

export function useMicrophoneTest() {
  const state = useAtomValue(microphoneTestAtom);
  const run = useAtomSet(microphoneTestRunAtom);
  const stop = useAtomSet(stopClipAtom);
  const phase = AsyncResult.getOrElse(useAtomValue(clipPhaseAtom), () => ({
    tag: 'idle' as const,
  }));
  return {
    state,
    isCapturing: isMicrophoneTestCapturing(state),
    isOccupied: phase.tag !== 'idle',
    start: (deviceId: string) => run(deviceId),
    stop: () => stop(undefined),
    discard: () => run(Atom.Reset),
  };
}
