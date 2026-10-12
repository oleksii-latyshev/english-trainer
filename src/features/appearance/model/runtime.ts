import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';

export const appearanceRuntime = Atom.runtime(
  KeyValueStore.layerStorage(() => window.localStorage),
);
