import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { audioInputsAtom } from './atoms';

export function useAudioInputOptions() {
  const result = useAtomValue(audioInputsAtom);
  const loadDevices = useAtomRefresh(audioInputsAtom);
  const inputs = AsyncResult.getOrElse(result, () => ({
    options: [],
    hasUnnamed: false,
    error: null,
  }));
  return {
    deviceOptions: inputs.options,
    hasUnnamed: inputs.hasUnnamed,
    deviceError: inputs.error,
    loadDevices,
  };
}
