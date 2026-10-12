import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import {
  addGlossaryTermAtom,
  glossaryAtom,
  glossaryDraftAtom,
  removeGlossaryTermAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { GlossaryService } from '../services/glossary-service';

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  terms: unknown;
  rejectSaves: boolean;
};

function makeRegistry(initial: unknown = ['Tauri']) {
  const rust: FakeRust = { calls: [], terms: initial, rejectSaves: false };
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        rust.calls.push({ command, args });
        switch (command) {
          case 'get_glossary':
            return Effect.sync((): unknown => rust.terms);
          case 'save_glossary':
            if (rust.rejectSaves) {
              return Effect.fail(
                new IpcError({ code: 'invalid_request', message: 'That word is too long.' }),
              );
            }
            return Effect.sync(() => {
              rust.terms = Reflect.get(args ?? {}, 'terms');
              return rust.terms;
            });
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  const layer = GlossaryService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
  registry.mount(glossaryAtom);
  return { registry, rust };
}

type Registry = ReturnType<typeof makeRegistry>['registry'];

function settledTerms(registry: Registry) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, glossaryAtom, { suspendOnWaiting: true }),
  );
}

it('reads the saved glossary', async () => {
  const { registry } = makeRegistry(['Tauri', 'Kubernetes']);
  expect(await settledTerms(registry)).toEqual(['Tauri', 'Kubernetes']);
});

it('adds a word to the saved ones and refreshes the glossary', async () => {
  const { registry, rust } = makeRegistry(['Tauri']);
  await settledTerms(registry);

  registry.set(glossaryDraftAtom, 'idempotent');
  registry.set(addGlossaryTermAtom, 'idempotent');
  await Effect.runPromise(AtomRegistry.getResult(registry, addGlossaryTermAtom));

  expect(registry.get(glossaryDraftAtom)).toBe('');

  expect(await settledTerms(registry)).toEqual(['Tauri', 'idempotent']);
  expect(rust.calls.find((call) => call.command === 'save_glossary')?.args).toEqual({
    terms: ['Tauri', 'idempotent'],
  });
});

it('removes one word and keeps the others', async () => {
  const { registry } = makeRegistry(['Tauri', 'Whisper', 'Oleksii']);
  await settledTerms(registry);

  registry.set(removeGlossaryTermAtom, 'Whisper');
  await Effect.runPromise(AtomRegistry.getResult(registry, removeGlossaryTermAtom));

  expect(await settledTerms(registry)).toEqual(['Tauri', 'Oleksii']);
});

it('keeps the shown glossary and reports the failure when a save is rejected', async () => {
  const { registry, rust } = makeRegistry(['Tauri']);
  await settledTerms(registry);
  rust.rejectSaves = true;

  registry.set(glossaryDraftAtom, 'x'.repeat(200));
  registry.set(addGlossaryTermAtom, 'x'.repeat(200));
  const exit = await Effect.runPromiseExit(AtomRegistry.getResult(registry, addGlossaryTermAtom));

  expect(exit._tag).toBe('Failure');
  expect(AsyncResult.isFailure(registry.get(addGlossaryTermAtom))).toBe(true);
  expect(registry.get(glossaryDraftAtom)).toBe('x'.repeat(200));
  expect(await settledTerms(registry)).toEqual(['Tauri']);
});
