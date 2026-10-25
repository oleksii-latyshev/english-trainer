import { Effect, Stream } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import { keyTarget } from '@/shared/helpers/key-target';
import { helpLevelForPress } from '../helpers/help-levels';
import { helpLevelAtom } from './atoms';
import { changeHelpLevel } from './help-level';
import { runtime } from './runtime';

function onKeyDown(registry: AtomRegistry.AtomRegistry, event: KeyboardEvent) {
  if (event.isComposing) return;
  const action = helpLevelForPress(
    {
      key: event.key,
      isRepeat: event.repeat,
      hasModifier: event.metaKey || event.ctrlKey || event.altKey,
      target: keyTarget(event.target),
    },
    { helpLevel: registry.get(helpLevelAtom), isHelpAvailable: true },
  );
  if (action === null) return;
  event.preventDefault();
  changeHelpLevel(registry, action.level);
}

export const helpKeyboardAtom = runtime.atom((get) => {
  const { registry } = get;
  return Stream.fromEventListener<KeyboardEvent>(window, 'keydown').pipe(
    Stream.runForEach((event) => Effect.sync(() => onKeyDown(registry, event))),
  );
});
