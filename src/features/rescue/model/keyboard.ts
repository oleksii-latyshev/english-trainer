import { Effect, Stream } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import { keyTarget } from '@/shared/helpers/key-target';
import { isRescueShortcut } from '../helpers/rescue-shortcut';
import { openRescue } from './commands';
import { runtime } from './runtime';

function onKeyDown(registry: AtomRegistry.AtomRegistry, event: KeyboardEvent) {
  const isShortcut = isRescueShortcut({
    key: event.key,
    isComposing: event.isComposing,
    isRepeat: event.repeat,
    hasModifier: event.metaKey || event.ctrlKey || event.altKey,
    target: keyTarget(event.target),
  });
  if (!isShortcut) return;
  event.preventDefault();
  openRescue(registry);
}

export const rescueKeyboardAtom = runtime.atom((get) => {
  const { registry } = get;
  return Stream.fromEventListener<KeyboardEvent>(window, 'keydown').pipe(
    Stream.runForEach((event) => Effect.sync(() => onKeyDown(registry, event))),
  );
});
