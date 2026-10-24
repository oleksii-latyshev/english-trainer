import { Effect, Stream } from 'effect';
import { readTextSelection } from '../helpers/selection-reader';
import { lookupCommandAtom, panelOpenAtom, selectionAtom } from './atoms';
import { resetTranslation } from './commands';
import { runtime } from './runtime';

const SELECTION_EVENTS = ['selectionchange', 'mouseup', 'keyup'] as const;

export const translationSessionAtom = runtime.atom((get) => {
  const { registry } = get;
  get.mount(lookupCommandAtom);
  get.addFinalizer(() => resetTranslation(registry));
  return Effect.gen(function* () {
    const changes = SELECTION_EVENTS.map((name) => Stream.fromEventListener<Event>(document, name));
    yield* Stream.mergeAll(changes, { concurrency: 'unbounded' }).pipe(
      Stream.runForEach(() =>
        Effect.sync(() => {
          if (!registry.get(panelOpenAtom)) registry.set(selectionAtom, readTextSelection());
        }),
      ),
    );
  });
});
