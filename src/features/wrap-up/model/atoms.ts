import { Clock, Effect, Stream } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { LEARNING_MEMORY, LearningMemoryService } from '@/core/learning-memory';
import { newlySavedCards } from '../helpers/newly-saved-cards';
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

export const wordTakenAtom = Atom.family((key: string) =>
  Atom.make((get) => get(takenWordsAtom)[key] === true),
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
