import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';
import { legacyDeviceStorage } from '../helpers/preferred-device';

export const preferenceRuntime = Atom.runtime(
  KeyValueStore.layerStorage(() => legacyDeviceStorage(window.localStorage)),
);
