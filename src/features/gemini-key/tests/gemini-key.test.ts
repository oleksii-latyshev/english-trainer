import { expect, it } from 'bun:test';
import { Deferred, Effect, Layer, Option } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { type GeminiKeyStatus, Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import {
  geminiKeyDraftAtom,
  geminiKeyFailureAtom,
  geminiKeyIsBusyAtom,
  geminiKeyStatusAtom,
  removeGeminiKeyAtom,
  saveGeminiKeyAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { GeminiKeyService } from '../services/gemini-key-service';

const VALID_KEY = 'AIzaSyExampleExampleExample1';

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  savePausedUntil: Deferred.Deferred<void> | null;
  readonly invalidStatusAnswer: unknown;
};

function makeFakeRust(invalidStatusAnswer?: unknown) {
  let savedKey: string | null = null;
  const rust: FakeRust = { calls: [], savePausedUntil: null, invalidStatusAnswer };

  const layer = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        rust.calls.push({ command, args });
        switch (command) {
          case 'get_gemini_key_status':
            return Effect.sync(
              (): unknown =>
                rust.invalidStatusAnswer ??
                ({
                  configured: savedKey !== null,
                  source: savedKey === null ? null : 'settings',
                } satisfies GeminiKeyStatus),
            );
          case 'save_gemini_api_key':
            return Effect.gen(function* () {
              if (rust.savePausedUntil) yield* Deferred.await(rust.savePausedUntil);
              const key = String(Reflect.get(args ?? {}, 'key')).trim();
              if (key.length < 20) {
                return yield* new IpcError({ code: 'invalid_request', message: 'Copy it again.' });
              }
              savedKey = key;
              return null;
            });
          case 'delete_gemini_api_key':
            return Effect.sync(() => {
              savedKey = null;
              return null;
            });
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  const serviceLayerWithReactivity = GeminiKeyService.layer.pipe(
    Layer.provide(layer),
    Layer.provideMerge(Reactivity.layer),
  );
  return { rust, layer: serviceLayerWithReactivity };
}

function mountAtomsTheComponentKeepsMounted(registry: AtomRegistry.AtomRegistry) {
  registry.mount(geminiKeyStatusAtom);
  registry.mount(geminiKeyIsBusyAtom);
  registry.mount(geminiKeyFailureAtom);
}

function makeRegistry(invalidStatusAnswer?: unknown) {
  const fake = makeFakeRust(invalidStatusAnswer);
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, fake.layer]] });
  mountAtomsTheComponentKeepsMounted(registry);
  return { registry, rust: fake.rust };
}

type Registry = ReturnType<typeof makeRegistry>['registry'];

function settledStatus(registry: Registry) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, geminiKeyStatusAtom, { suspendOnWaiting: true }),
  );
}

async function saveKeyAndSettle(registry: Registry, key: string) {
  registry.set(saveGeminiKeyAtom, key);
  await Effect.runPromiseExit(AtomRegistry.getResult(registry, saveGeminiKeyAtom));
}

it('reads the status from Rust when first needed', async () => {
  const { registry } = makeRegistry();
  expect(await settledStatus(registry)).toEqual({ configured: false, source: null });
});

it('refreshes the status after a save and clears the draft', async () => {
  const { registry } = makeRegistry();
  await settledStatus(registry);
  registry.set(geminiKeyDraftAtom, VALID_KEY);

  await saveKeyAndSettle(registry, VALID_KEY);

  expect(await settledStatus(registry)).toEqual({ configured: true, source: 'settings' });
  expect(registry.get(geminiKeyDraftAtom)).toBe('');
  expect(registry.get(geminiKeyIsBusyAtom)).toBe(false);
  expect(Option.isNone(registry.get(geminiKeyFailureAtom))).toBe(true);
});

it('sends the key to Rust as the `key` argument', async () => {
  const { registry, rust } = makeRegistry();
  await saveKeyAndSettle(registry, VALID_KEY);
  expect(rust.calls.find((call) => call.command === 'save_gemini_api_key')?.args).toEqual({
    key: VALID_KEY,
  });
});

it('reports a rejected key by its code and keeps what was typed', async () => {
  const { registry } = makeRegistry();
  registry.set(geminiKeyDraftAtom, 'short');

  await saveKeyAndSettle(registry, 'short');

  const failure = registry.get(geminiKeyFailureAtom);
  expect(Option.isSome(failure) && failure.value).toMatchObject({
    _tag: 'IpcError',
    code: 'invalid_request',
  });
  expect(registry.get(geminiKeyDraftAtom)).toBe('short');
  expect(await settledStatus(registry)).toEqual({ configured: false, source: null });
});

it('is busy while a save runs and hides the earlier failure', async () => {
  const { registry, rust } = makeRegistry();
  await settledStatus(registry);
  await saveKeyAndSettle(registry, 'short');
  expect(Option.isSome(registry.get(geminiKeyFailureAtom))).toBe(true);

  rust.savePausedUntil = Effect.runSync(Deferred.make<void>());
  registry.set(saveGeminiKeyAtom, VALID_KEY);
  expect(registry.get(geminiKeyIsBusyAtom)).toBe(true);
  expect(Option.isNone(registry.get(geminiKeyFailureAtom))).toBe(true);

  Effect.runSync(Deferred.succeed(rust.savePausedUntil, undefined));
  await Effect.runPromise(AtomRegistry.getResult(registry, saveGeminiKeyAtom));
  await settledStatus(registry);
  expect(registry.get(geminiKeyIsBusyAtom)).toBe(false);
});

it('removes the key and refreshes the status', async () => {
  const { registry } = makeRegistry();
  await saveKeyAndSettle(registry, VALID_KEY);
  expect(await settledStatus(registry)).toEqual({ configured: true, source: 'settings' });

  registry.set(removeGeminiKeyAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, removeGeminiKeyAtom));

  expect(await settledStatus(registry)).toEqual({ configured: false, source: null });
});

it('forgets a failed save once a later removal succeeds', async () => {
  const { registry } = makeRegistry();
  await saveKeyAndSettle(registry, 'short');
  expect(Option.isSome(registry.get(geminiKeyFailureAtom))).toBe(true);

  registry.set(removeGeminiKeyAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, removeGeminiKeyAtom));

  expect(Option.isNone(registry.get(geminiKeyFailureAtom))).toBe(true);
});

it('fails with IpcDecodeError when Rust answers with an inconsistent status', async () => {
  const { registry } = makeRegistry({ configured: true, source: 'keychain' });

  const result = await Effect.runPromise(
    AtomRegistry.getResult(registry, geminiKeyStatusAtom).pipe(Effect.flip),
  );

  expect(result).toBeInstanceOf(IpcDecodeError);
  const failure = registry.get(geminiKeyFailureAtom);
  expect(Option.isSome(failure) && failure.value).toBeInstanceOf(IpcDecodeError);
  expect(AsyncResult.isFailure(registry.get(geminiKeyStatusAtom))).toBe(true);
});
