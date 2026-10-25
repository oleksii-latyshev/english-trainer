import { Clock, Effect, Stream } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { ipcFailureMessage } from '@/core/ipc';
import { LEARNING_MEMORY, LearningMemoryService } from '@/core/learning-memory';
import { newlySavedCards } from '../helpers/newly-saved-cards';
import { markSaved, NO_SELECTION, unmarkSaved } from '../helpers/phrase-selection';
import { WrapUpService } from '../services/wrap-up-service';
import type { AnswerPhrase, PhraseSelection } from '../types';
import { runtime } from './runtime';
import { showRemovedToast, showSavedToast, showUndoFailedToast } from './saved-toast';

export const RETRY_FAILED = 'Could not prepare phrases. Please retry.';

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

const selectionsAtom = Atom.keepAlive(Atom.make<ReadonlyMap<number, PhraseSelection>>(new Map()));

export const phraseSelectionAtom = Atom.family((sessionId: number) =>
  Atom.make((get) => get(selectionsAtom).get(sessionId) ?? NO_SELECTION),
);

export function changeSelection(
  registry: AtomRegistry.AtomRegistry,
  sessionId: number,
  change: (selection: PhraseSelection) => PhraseSelection,
) {
  registry.update(selectionsAtom, (known) =>
    new Map(known).set(sessionId, change(known.get(sessionId) ?? NO_SELECTION)),
  );
}

type UndoPhrases = { readonly phrases: readonly string[]; readonly cardIds: readonly number[] };

function removeCards(cardIds: readonly number[]) {
  return Effect.gen(function* () {
    const memory = yield* LearningMemoryService;
    yield* Effect.forEach(cardIds, (itemId) => memory.remove({ itemType: 'phrase', itemId }), {
      concurrency: 'unbounded',
    });
  }).pipe(Effect.tapError(() => Effect.sync(showUndoFailedToast)));
}

export const undoPhrasesAtom = Atom.family((sessionId: number) =>
  Atom.keepAlive(
    runtime.fn(
      Effect.fn('undoWrapupSave')(function* (undo: UndoPhrases, get: Atom.FnContext) {
        yield* removeCards(undo.cardIds);
        changeSelection(get.registry, sessionId, (selection) =>
          unmarkSaved(selection, undo.phrases),
        );
        showRemovedToast();
      }),
      { reactivityKeys: LEARNING_MEMORY },
    ),
  ),
);

export const savePhrasesAtom = Atom.family((sessionId: number) =>
  runtime.fn(
    Effect.fn('saveWrapupPhrases')(function* (phrases: readonly string[], get: Atom.FnContext) {
      const service = yield* WrapUpService;
      const saved = yield* service.savePhrases(sessionId, phrases);
      changeSelection(get.registry, sessionId, (selection) => markSaved(selection, phrases));
      const canUndo = saved.created_ids.length > 0;
      showSavedToast(
        canUndo
          ? () =>
              get.registry.set(undoPhrasesAtom(sessionId), { phrases, cardIds: saved.created_ids })
          : undefined,
      );
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

export const retryPreparationAtom = Atom.family((sessionId: number) =>
  runtime.fn(
    Effect.fn('retryWrapupPreparation')(function* (_: undefined, get: Atom.FnContext) {
      const service = yield* WrapUpService;
      yield* service.retryPreparation(sessionId);
      get.refresh(wrapupAtom(sessionId));
    }),
  ),
);

export function retryMessageOf(failure: Parameters<typeof ipcFailureMessage>[0]): string {
  return ipcFailureMessage(failure, RETRY_FAILED);
}

const savedAnswersAtom = Atom.keepAlive(Atom.make<Readonly<Record<string, boolean>>>({}));

export const answerSavedAtom = Atom.family((key: string) =>
  Atom.make((get) => get(savedAnswersAtom)[key] === true),
);

function setAnswerSaved(registry: AtomRegistry.AtomRegistry, key: string, isSaved: boolean) {
  registry.update(savedAnswersAtom, (known) => ({ ...known, [key]: isSaved }));
}

export const undoAnswerAtom = Atom.family((key: string) =>
  Atom.keepAlive(
    runtime.fn(
      Effect.fn('undoAnswerSave')(function* (cardId: number, get: Atom.FnContext) {
        yield* removeCards([cardId]);
        setAnswerSaved(get.registry, key, false);
        showRemovedToast();
      }),
      { reactivityKeys: LEARNING_MEMORY },
    ),
  ),
);

export const saveAnswerAtom = Atom.family((key: string) =>
  runtime.fn(
    Effect.fn('saveAnswerPhrase')(function* (answer: AnswerPhrase, get: Atom.FnContext) {
      const service = yield* WrapUpService;
      const requestedAt = yield* Clock.currentTimeMillis;
      const card = yield* service.saveAnswerPhrase(answer);
      setAnswerSaved(get.registry, key, true);
      const [created] = newlySavedCards([card], requestedAt);
      showSavedToast(created ? () => get.registry.set(undoAnswerAtom(key), created.id) : undefined);
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);
