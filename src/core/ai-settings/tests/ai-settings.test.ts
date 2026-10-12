import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { type AiSettings, Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import {
  aiSettingsAtom,
  prewarmConversationProviderAtom,
  updateAiSettingsAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { AiSettingsService } from '../services/ai-settings-service';

const DEFAULTS: AiSettings = { provider: 'gemini', agy_model: 'default', eva_style: 'natural' };

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  stored: unknown;
  rejectSaves: boolean;
};

function makeRegistry(initial: unknown = DEFAULTS) {
  const rust: FakeRust = { calls: [], stored: initial, rejectSaves: false };
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        rust.calls.push({ command, args });
        switch (command) {
          case 'get_ai_settings':
            return Effect.sync((): unknown => rust.stored);
          case 'save_ai_settings':
            if (rust.rejectSaves) {
              return Effect.fail(
                new IpcError({ code: 'database_error', message: 'Could not save locally.' }),
              );
            }
            return Effect.sync(() => {
              rust.stored = Reflect.get(args ?? {}, 'settings');
              return rust.stored;
            });
          case 'prewarm_conversation_provider':
            return Effect.succeed(null);
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  const layer = AiSettingsService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
  registry.mount(aiSettingsAtom);
  return { registry, rust };
}

type Registry = ReturnType<typeof makeRegistry>['registry'];

function settledSettings(registry: Registry) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, aiSettingsAtom, { suspendOnWaiting: true }),
  );
}

it('reads the saved settings from Rust when first needed', async () => {
  const { registry } = makeRegistry({ ...DEFAULTS, provider: 'apple' });
  expect(await settledSettings(registry)).toEqual({ ...DEFAULTS, provider: 'apple' });
});

it('changes one field, keeps the others and refreshes the settings', async () => {
  const { registry, rust } = makeRegistry({ ...DEFAULTS, agy_model: 'gemini-3.8-flash-low' });
  await settledSettings(registry);

  registry.set(updateAiSettingsAtom, { provider: 'apple' });
  await Effect.runPromise(AtomRegistry.getResult(registry, updateAiSettingsAtom));

  const expected: AiSettings = {
    provider: 'apple',
    agy_model: 'gemini-3.8-flash-low',
    eva_style: 'natural',
  };
  expect(await settledSettings(registry)).toEqual(expected);
  expect(rust.calls.find((call) => call.command === 'save_ai_settings')?.args).toEqual({
    settings: expected,
  });
});

it('keeps the shown settings and reports the failure when a save is rejected', async () => {
  const { registry, rust } = makeRegistry();
  await settledSettings(registry);
  rust.rejectSaves = true;

  registry.set(updateAiSettingsAtom, { provider: 'agy' });
  const exit = await Effect.runPromiseExit(AtomRegistry.getResult(registry, updateAiSettingsAtom));

  expect(exit._tag).toBe('Failure');
  const result = registry.get(updateAiSettingsAtom);
  expect(AsyncResult.isFailure(result)).toBe(true);
  expect(await settledSettings(registry)).toEqual(DEFAULTS);
});

it('fails with IpcDecodeError when Rust answers with an unknown provider', async () => {
  const { registry } = makeRegistry({ ...DEFAULTS, provider: 'openai' });
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, aiSettingsAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});

it('asks Rust to warm the saved provider', async () => {
  const { registry, rust } = makeRegistry();
  registry.set(prewarmConversationProviderAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, prewarmConversationProviderAtom));
  expect(rust.calls.map((call) => call.command)).toContain('prewarm_conversation_provider');
});
