import { Effect, Stream } from 'effect';
import { Atom } from 'effect/reactivity';
import { learningMemoryRuntime } from '@/core/learning-memory';
import { keyTarget } from '@/shared/helpers/key-target';
import {
  decideReviewKeyDown,
  decideReviewKeyUp,
  type ReviewKeyCommand,
} from '../helpers/review-keys';
import { listeningOf } from '../helpers/review-phase';
import { cancelAnswer, finishAnswer, startAnswer, stopSpeech } from './answer-controls';
import { isEvaSpeakingAtom, phaseAtom } from './prompt-atoms';
import { isAnsweringAtom, isBusyAtom } from './view-atoms';

const holdingSpaceAtom = Atom.make(false);

export const keyboardAtom = learningMemoryRuntime.atom((get) => {
  const { registry } = get;

  function run(command: ReviewKeyCommand) {
    switch (command.kind) {
      case 'hold-to-talk':
        registry.set(holdingSpaceAtom, true);
        startAnswer(registry);
        return;
      case 'cancel-listening':
        cancelAnswer(registry);
        return;
      case 'stop-eva':
        stopSpeech(registry);
        return;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.isComposing) return;
    const phase = registry.get(phaseAtom);
    const command = decideReviewKeyDown(
      {
        key: event.key,
        isRepeat: event.repeat,
        hasModifier: event.metaKey || event.ctrlKey || event.altKey,
        target: keyTarget(event.target),
      },
      {
        canStart: registry.get(isAnsweringAtom) && phase === 'prompt' && !registry.get(isBusyAtom),
        listening: listeningOf(phase),
        isEvaSpeaking: registry.get(isEvaSpeakingAtom),
        isHoldingSpace: registry.get(holdingSpaceAtom),
      },
    );
    if (command === null) return;
    event.preventDefault();
    run(command);
  }

  function release() {
    const outcome = decideReviewKeyUp(' ', {
      listening: listeningOf(registry.get(phaseAtom)),
      isHoldingSpace: registry.get(holdingSpaceAtom),
    });
    registry.set(holdingSpaceAtom, false);
    if (outcome === 'stop-listening') finishAnswer(registry);
    if (outcome === 'cancel-listening') cancelAnswer(registry);
  }

  return Effect.gen(function* () {
    const down = Stream.fromEventListener<KeyboardEvent>(window, 'keydown').pipe(
      Stream.map((event) => () => onKeyDown(event)),
    );
    const up = Stream.fromEventListener<KeyboardEvent>(window, 'keyup').pipe(
      Stream.filter((event) => event.key === ' '),
      Stream.map(() => release),
    );
    const blur = Stream.fromEventListener<FocusEvent>(window, 'blur').pipe(
      Stream.map(() => release),
    );
    yield* Stream.merge(Stream.merge(down, up), blur).pipe(
      Stream.runForEach((handle) => Effect.sync(handle)),
    );
  });
});
