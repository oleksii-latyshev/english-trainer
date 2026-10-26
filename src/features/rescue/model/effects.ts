import { Atom } from 'effect/reactivity';
import { closeRescue } from './commands';
import { rescueKeyboardAtom } from './keyboard';

export const rescueSurfaceAtom = Atom.make((get) => {
  const { registry } = get;
  get.mount(rescueKeyboardAtom);
  get.addFinalizer(() => closeRescue(registry));
});
