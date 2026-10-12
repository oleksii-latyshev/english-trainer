import { useAtom, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  parsePreferredDeviceId,
  STORAGE_AVAILABLE,
  STORAGE_MISSING,
} from '../helpers/preferred-device';
import { actualInputAtom } from './atoms';
import { preferredMicrophoneAtom, storageStatusAtom } from './preferred-microphone';

export function usePreferredMicrophone() {
  const [selectedDeviceId, setDeviceId] = useAtom(preferredMicrophoneAtom);
  const actualInput = AsyncResult.getOrElse(useAtomValue(actualInputAtom), () => null);
  const storage = useAtomValue(storageStatusAtom);
  return {
    selectedDeviceId,
    selectDevice: (id: string) => setDeviceId(parsePreferredDeviceId(id)),
    storageStatus: AsyncResult.isFailure(storage)
      ? STORAGE_MISSING
      : AsyncResult.getOrElse(storage, () => STORAGE_AVAILABLE),
    actualInput,
  };
}
