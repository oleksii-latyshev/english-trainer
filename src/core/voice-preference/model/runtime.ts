import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';

export const voicePreferenceRuntime = Atom.runtime(
  KeyValueStore.layerStorage(() => window.localStorage),
);
