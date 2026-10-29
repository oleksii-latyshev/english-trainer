import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  LEARNING_MEMORY,
  LearningMemoryService,
  learningMemoryRuntime,
  openedLearningMemoryAtom,
} from '@/core/learning-memory';
import { toast } from '@/shared/ui/toast';
import { type Library, libraryOf } from '../helpers/library-state';
import { entryRef, searchEntries, visibleEntries } from '../helpers/memory-entries';
import type { MemoryEntry } from '../types';

export const searchQueryAtom = Atom.make('');
export const showArchivedAtom = Atom.make(false);
export const openEntryKeyAtom = Atom.make<string | null>(null);
export const pendingDeleteAtom = Atom.make<MemoryEntry | null>(null);

export const libraryAtom = Atom.make((get): Library => libraryOf(get(openedLearningMemoryAtom)));

export const shownEntriesAtom = Atom.make((get): readonly MemoryEntry[] => {
  const library = get(libraryAtom);
  if (library.tag !== 'ready') return [];
  return searchEntries(
    visibleEntries(library.entries, get(showArchivedAtom)),
    get(searchQueryAtom),
  );
});

export const archiveEntryAtom = learningMemoryRuntime.fn(
  Effect.fn('archiveEntry')(
    function* (entry: MemoryEntry) {
      const service = yield* LearningMemoryService;
      yield* service.archive(entryRef(entry));
      toast('Archived. Saving it again brings it back.');
    },
    Effect.tapError(() =>
      Effect.sync(() => toast.danger('Could not archive that. Please try again.')),
    ),
  ),
  { reactivityKeys: LEARNING_MEMORY },
);

export const confirmDeleteAtom = learningMemoryRuntime.fn(
  Effect.fn('confirmDelete')(
    function* (_: undefined, get: Atom.FnContext) {
      const entry = get(pendingDeleteAtom);
      if (entry === null) return;
      const service = yield* LearningMemoryService;
      yield* service.remove(entryRef(entry));
      toast('Removed from Memory');
      get.set(pendingDeleteAtom, null);
    },
    Effect.tapError(() =>
      Effect.sync(() => toast.danger('Could not remove that. Please try again.')),
    ),
  ),
  { reactivityKeys: LEARNING_MEMORY },
);
