import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';

export const evaLookRuntime = Atom.runtime(KeyValueStore.layerStorage(() => window.localStorage));
