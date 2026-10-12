import { Effect } from 'effect';
import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';
import { appRegistry } from '@/core/runtime';
import type { StorageStatus } from '../audio';
import {
  PREFERRED_MICROPHONE_KEY,
  PreferredDeviceSchema,
  parsePreferredDeviceId,
  STORAGE_AVAILABLE,
  STORAGE_BLOCKED,
} from '../helpers/preferred-device';
import { preferenceRuntime } from './preference-runtime';

export const preferredMicrophoneAtom = Atom.kvs({
  runtime: preferenceRuntime,
  key: PREFERRED_MICROPHONE_KEY,
  schema: PreferredDeviceSchema,
  defaultValue: () => '',
  mode: 'sync',
});

export const storageStatusAtom = preferenceRuntime.atom(
  KeyValueStore.KeyValueStore.use((store) => store.has(PREFERRED_MICROPHONE_KEY)).pipe(
    Effect.as<StorageStatus>(STORAGE_AVAILABLE),
    Effect.catch(() => Effect.succeed<StorageStatus>(STORAGE_BLOCKED)),
  ),
);

let isMounted = false;

export function readPreferredMicrophone(): string {
  if (!isMounted) {
    appRegistry.mount(preferredMicrophoneAtom);
    isMounted = true;
  }
  return parsePreferredDeviceId(appRegistry.get(preferredMicrophoneAtom));
}
