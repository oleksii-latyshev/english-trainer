import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';

export const firstRunRuntime = Atom.runtime(KeyValueStore.layerStorage(() => window.localStorage));
