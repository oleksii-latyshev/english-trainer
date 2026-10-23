import { Effect, Stream } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { cancelListening, holdListening, stopListening } from '@/core/answer-capture';
import { turnRuntime } from '@/core/practice-turn';
import { keyTarget } from '@/shared/helpers/key-target';
import { decideKeyDown, decideKeyUp, shouldKeepTurnOpen } from '../helpers/talk-keys';
import { cancelCountdown, startAnswer, stopEva } from './commands';
import { abandonedStartAtom, countdownLabelAtom, holdingSpaceAtom } from './draft-atoms';
import { canPressMicAtom, turnStateAtom } from './view-atoms';

function onKeyDown(registry: AtomRegistry.AtomRegistry, event: KeyboardEvent) {
  if (event.isComposing) return;
  const state = registry.get(turnStateAtom);
  const command = decideKeyDown(
    {
      key: event.key,
      isRepeat: event.repeat,
      hasModifier: event.metaKey || event.ctrlKey || event.altKey,
      target: keyTarget(event.target),
    },
    {
      state,
      canPressMic: registry.get(canPressMicAtom),
      isCountingDown: state.tag === 'review' && registry.get(countdownLabelAtom) !== null,
      isHoldingSpace: registry.get(holdingSpaceAtom),
    },
  );
  if (command === null) return;
  event.preventDefault();
  switch (command.kind) {
    case 'hold-to-talk':
      registry.set(holdingSpaceAtom, true);
      registry.set(abandonedStartAtom, false);
      startAnswer(registry);
      return;
    case 'adopt-listening':
      registry.set(holdingSpaceAtom, true);
      holdListening(registry, true);
      return;
    case 'cancel-listening':
      registry.set(abandonedStartAtom, false);
      cancelListening(registry);
      return;
    case 'cancel-countdown':
      cancelCountdown(registry);
      return;
    case 'stop-eva':
      stopEva(registry);
      return;
  }
}

function release(registry: AtomRegistry.AtomRegistry) {
  const state = registry.get(turnStateAtom);
  const wasHolding = registry.get(holdingSpaceAtom);
  const outcome = decideKeyUp(' ', { state, isHoldingSpace: wasHolding });
  registry.set(holdingSpaceAtom, false);
  if (outcome === null) {
    if (wasHolding) registry.set(abandonedStartAtom, true);
    return;
  }
  registry.set(abandonedStartAtom, false);
  if (outcome === 'stop-listening') stopListening(registry);
  else cancelListening(registry);
}

export const keyboardAtom = turnRuntime.atom((get) => {
  const { registry } = get;
  return Effect.gen(function* () {
    const down = Stream.fromEventListener<KeyboardEvent>(window, 'keydown').pipe(
      Stream.map((event) => () => onKeyDown(registry, event)),
    );
    const up = Stream.fromEventListener<KeyboardEvent>(window, 'keyup').pipe(
      Stream.filter((event) => event.key === ' '),
      Stream.map(() => () => release(registry)),
    );
    const blur = Stream.fromEventListener<FocusEvent>(window, 'blur').pipe(
      Stream.map(() => () => release(registry)),
    );
    yield* Stream.merge(Stream.merge(down, up), blur).pipe(
      Stream.runForEach((handle) => Effect.sync(handle)),
    );
  });
});

export const holdKeptOpenAtom = Atom.make((get) => {
  const { registry } = get;
  const state = get(turnStateAtom);
  const isListening = state.tag === 'listening' || state.tag === 'auto-listen';
  if (isListening && registry.get(abandonedStartAtom)) {
    registry.set(abandonedStartAtom, false);
    cancelListening(registry);
    return;
  }
  if (state.tag === 'transcribing' || state.tag === 'error')
    registry.set(abandonedStartAtom, false);
  if (shouldKeepTurnOpen(state, get(holdingSpaceAtom))) holdListening(registry, true);
});
