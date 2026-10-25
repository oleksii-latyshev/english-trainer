import { Atom } from 'effect/reactivity';
import { exampleGuardAtom } from './example-guard';
import { openHelpAtom } from './help-level';
import { helpKeyboardAtom } from './keyboard';
import { loadPlanAtom, planPrefetchAtom } from './plan';
import { cancelPlanning, planningTickAtom } from './planning';

export const answerHelpEffectsAtom = Atom.make((get) => {
  get.mount(openHelpAtom);
  get.mount(loadPlanAtom);
  get.mount(exampleGuardAtom);
});

export const helpSurfaceAtom = Atom.make((get) => {
  const { registry } = get;
  get.mount(planPrefetchAtom);
  get.mount(helpKeyboardAtom);
  get.mount(planningTickAtom);
  get.addFinalizer(() => cancelPlanning(registry));
});
