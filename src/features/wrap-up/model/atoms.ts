import { Clock, Effect, Option, Stream } from 'effect';
import { AsyncResult, Atom, type AtomRegistry } from 'effect/reactivity';
import { LEARNING_MEMORY, LearningMemoryService, learningMemoryAtom } from '@/core/learning-memory';
import { newlySavedCards } from '../helpers/newly-saved-cards';
import { savedWordKeys } from '../helpers/saved-word-keys';
import { WrapUpService } from '../services/wrap-up-service';
import type { TakenWord } from '../types';
import { runtime } from './runtime';
import { showRemovedToast, showSavedToast, showUndoFailedToast } from './saved-toast';

export const wrapupAtom = Atom.family((sessionId: number) =>
  runtime.atom(Effect.flatMap(WrapUpService, (service) => service.read(sessionId))),
);

export const wrapupUpdatesAtom = Atom.family((sessionId: number) =>
  runtime.atom((get) =>
    Effect.flatMap(WrapUpService, (service) =>
      Stream.runForEach(service.updates(sessionId), () =>
        Effect.sync(() => get.registry.refresh(wrapupAtom(sessionId))),
      ),
    ),
  ),
);

function removeCards(cardIds: readonly number[]) {
  return Effect.gen(function* () {
    const memory = yield* LearningMemoryService;
    yield* Effect.forEach(cardIds, (itemId) => memory.remove({ itemType: 'phrase', itemId }), {
      concurrency: 'unbounded',
    });
  }).pipe(Effect.tapError(() => Effect.sync(showUndoFailedToast)));
}

export const takenWordsAtom = Atom.keepAlive(Atom.make<Readonly<Record<string, boolean>>>({}));

export const savedKeysAtom = Atom.make((get): ReadonlySet<string> => {
  const memory = Option.getOrNull(AsyncResult.value(get(learningMemoryAtom)));
  return memory ? savedWordKeys(memory.phrase_cards) : new Set();
});

export function isWordTaken(
  known: Readonly<Record<string, boolean>>,
  saved: ReadonlySet<string>,
  key: string,
): boolean {
  return known[key] ?? saved.has(key);
}

export const wordTakenAtom = Atom.family((key: string) =>
  Atom.make((get) => isWordTaken(get(takenWordsAtom), get(savedKeysAtom), key)),
);

function setWordTaken(registry: AtomRegistry.AtomRegistry, key: string, isTaken: boolean) {
  registry.update(takenWordsAtom, (known) => ({ ...known, [key]: isTaken }));
}

export const undoTakeAtom = Atom.family((key: string) =>
  Atom.keepAlive(
    runtime.fn(
      Effect.fn('undoTakeWord')(function* (cardId: number, get: Atom.FnContext) {
        yield* removeCards([cardId]);
        setWordTaken(get.registry, key, false);
        showRemovedToast();
      }),
      { reactivityKeys: LEARNING_MEMORY },
    ),
  ),
);

export const takeWordAtom = Atom.family((key: string) =>
  runtime.fn(
    Effect.fn('takeWord')(function* (word: TakenWord, get: Atom.FnContext) {
      const service = yield* WrapUpService;
      const requestedAt = yield* Clock.currentTimeMillis;
      const card = yield* service.saveWord(word);
      setWordTaken(get.registry, key, true);
      const [created] = newlySavedCards([card], requestedAt);
      showSavedToast(created ? () => get.registry.set(undoTakeAtom(key), created.id) : undefined);
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);
