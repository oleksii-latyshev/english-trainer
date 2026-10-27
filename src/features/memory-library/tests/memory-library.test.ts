import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, type IpcArgs, IpcDecodeError } from '@/core/ipc';
import { LearningMemoryService, learningMemoryRuntime } from '@/core/learning-memory';
import {
  archiveEntryAtom,
  confirmDeleteAtom,
  libraryAtom,
  pendingDeleteAtom,
  searchQueryAtom,
  showArchivedAtom,
  shownCountsAtom,
  shownEntriesAtom,
} from '../model/atoms';

const BASE_CARD = {
  kind: 'phrase' as const,
  normalized_phrase: '',
  meaning_or_note: '',
  session_id: null,
  sequence: null,
  created_at: 1,
  last_reviewed_at: null,
  next_review_at: 1,
  interval_days: 1,
  ease_factor: 2.5,
  is_due: false,
  times_used_on_own: 0,
};

const BASE_MISTAKE = {
  normalized_key: 'k',
  category: 'grammar',
  explanation: 'Because.',
  times_seen: 2,
  times_correct_afterwards: 0,
  last_seen_at: 1,
  last_reviewed_at: null,
  next_review_at: 1,
  interval_days: 1,
  ease_factor: 2.5,
  is_due: false,
};

type Stored = { phrases: Array<Record<string, unknown>>; mistakes: Array<Record<string, unknown>> };

function makeRegistry() {
  const calls: Array<{ command: string; args: IpcArgs | undefined }> = [];
  const stored: Stored = {
    phrases: [
      { ...BASE_CARD, id: 1, phrase: 'figure out', status: 'learning' },
      { ...BASE_CARD, id: 2, phrase: 'stale data', status: 'archived' },
    ],
    mistakes: [
      {
        ...BASE_MISTAKE,
        id: 7,
        original_example: 'in the university',
        corrected_example: 'at university',
        status: 'new',
      },
    ],
  };
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcDecodeError> => {
        calls.push({ command, args });
        switch (command) {
          case 'view_learning_memory':
            return Effect.succeed({
              phrase_cards: stored.phrases,
              mistakes: stored.mistakes,
              due_count: 0,
            });
          case 'archive_learning_item':
            return Effect.succeed(true);
          case 'delete_phrase_card':
            stored.phrases = stored.phrases.filter((card) => card.id !== args?.phrase_id);
            return Effect.succeed(true);
          case 'delete_mistake':
            stored.mistakes = stored.mistakes.filter((item) => item.id !== args?.mistake_id);
            return Effect.succeed(true);
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  const layer = LearningMemoryService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({
    initialValues: [[learningMemoryRuntime.layer, layer]],
  });
  registry.mount(libraryAtom);
  return { registry, calls };
}

async function ready(registry: AtomRegistry.AtomRegistry): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (registry.get(libraryAtom).tag === 'ready') return;
    await Bun.sleep(2);
  }
}

it('opens Memory with the command that marks the cues as shown', async () => {
  const { registry, calls } = makeRegistry();
  await ready(registry);
  expect(calls.map((call) => call.command)).toEqual(['view_learning_memory']);
  expect(registry.get(shownCountsAtom)).toEqual({ phrases: 1, mistakes: 1 });
});

it('hides archived items until the learner asks for them', async () => {
  const { registry } = makeRegistry();
  await ready(registry);
  expect(registry.get(shownEntriesAtom)).toHaveLength(2);
  registry.set(showArchivedAtom, true);
  expect(registry.get(shownEntriesAtom)).toHaveLength(3);
});

it('filters both lists by the search text', async () => {
  const { registry } = makeRegistry();
  await ready(registry);
  registry.set(searchQueryAtom, 'university');
  expect(registry.get(shownCountsAtom)).toEqual({ phrases: 0, mistakes: 1 });
});

it('archives an entry by its type and id and reloads Memory', async () => {
  const { registry, calls } = makeRegistry();
  await ready(registry);
  const [phrase] = registry.get(shownEntriesAtom);
  if (!phrase) throw new Error('expected a phrase');
  registry.set(archiveEntryAtom, phrase);
  await Effect.runPromise(AtomRegistry.getResult(registry, archiveEntryAtom));
  expect(calls.find((call) => call.command === 'archive_learning_item')?.args).toEqual({
    item_type: 'phrase',
    item_id: 1,
  });
});

it('deletes the entry waiting for a yes, closes the dialog and drops it from the list', async () => {
  const { registry, calls } = makeRegistry();
  await ready(registry);
  const mistake = registry.get(shownEntriesAtom).find((entry) => entry.kind === 'mistake');
  if (!mistake) throw new Error('expected a mistake');
  registry.set(pendingDeleteAtom, mistake);
  registry.set(confirmDeleteAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, confirmDeleteAtom));
  expect(calls.find((call) => call.command === 'delete_mistake')?.args).toEqual({ mistake_id: 7 });
  expect(registry.get(pendingDeleteAtom)).toBeNull();
  for (let attempt = 0; attempt < 100 && registry.get(shownCountsAtom).mistakes > 0; attempt += 1) {
    await Bun.sleep(2);
  }
  expect(registry.get(shownCountsAtom).mistakes).toBe(0);
});

it('does nothing when no entry is waiting for a yes', async () => {
  const { registry, calls } = makeRegistry();
  await ready(registry);
  registry.set(confirmDeleteAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, confirmDeleteAtom));
  const commands = calls.map((call) => call.command);
  expect(commands).not.toContain('delete_mistake');
  expect(commands).not.toContain('delete_phrase_card');
});
