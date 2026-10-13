import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { Ipc, IpcError } from '@/core/ipc';
import { setupDiagnosticsAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { SetupDiagnosticsService } from '../services/setup-diagnostics-service';

const MISSING = { status: 'missing', path: null, message: 'Not installed.' };
const FOUND = { status: 'available', path: '/opt/homebrew/bin/whisper-cli', message: 'Found.' };

function makeRegistry(answer: () => unknown) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command) =>
      command === 'get_setup_diagnostics'
        ? Effect.sync(answer).pipe(
            Effect.flatMap((value) =>
              value instanceof IpcError ? Effect.fail(value) : Effect.succeed(value),
            ),
          )
        : Effect.die(command),
  });
  const registry = AtomRegistry.make({
    initialValues: [
      [runtime.layer, Layer.fresh(SetupDiagnosticsService.layer).pipe(Layer.provide(ipc))],
    ],
  });
  registry.mount(setupDiagnosticsAtom);
  return registry;
}

async function diagnostics(registry: AtomRegistry.AtomRegistry) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, setupDiagnosticsAtom, { suspendOnWaiting: true }),
  );
}

it('reads the files setup relies on', async () => {
  const registry = makeRegistry(() => ({
    whisper_cli: FOUND,
    whisper_model: MISSING,
    whisper_server: MISSING,
    agy_cli: MISSING,
    database_path: '/data/english-trainer.sqlite3',
  }));
  const loaded = await diagnostics(registry);
  expect(loaded.whisper_cli.status).toBe('available');
  expect(loaded.whisper_model.path).toBeNull();
  expect(loaded.agy_default_model).toBeUndefined();
});

it('reads the default Antigravity model when the app found one', async () => {
  const registry = makeRegistry(() => ({
    whisper_cli: FOUND,
    whisper_model: FOUND,
    whisper_server: FOUND,
    agy_cli: FOUND,
    database_path: '/data/english-trainer.sqlite3',
    agy_default_model: 'Gemini 3.8 Flash',
  }));
  expect((await diagnostics(registry)).agy_default_model).toBe('Gemini 3.8 Flash');
});

it('rechecking asks the backend again', async () => {
  let reads = 0;
  const registry = makeRegistry(() => {
    reads += 1;
    return {
      whisper_cli: reads === 1 ? MISSING : FOUND,
      whisper_model: FOUND,
      whisper_server: FOUND,
      agy_cli: FOUND,
      database_path: '/data/english-trainer.sqlite3',
    };
  });
  expect((await diagnostics(registry)).whisper_cli.status).toBe('missing');
  registry.refresh(setupDiagnosticsAtom);
  const next = await diagnostics(registry);
  expect(next.whisper_cli.status).toBe('available');
});

it('fails with a typed error when the answer has an unexpected shape', async () => {
  const registry = makeRegistry(() => ({ database_path: 3 }));
  const exit = await Effect.runPromiseExit(
    AtomRegistry.getResult(registry, setupDiagnosticsAtom, { suspendOnWaiting: true }),
  );
  expect(exit._tag).toBe('Failure');
  expect(AsyncResult.isFailure(registry.get(setupDiagnosticsAtom))).toBe(true);
});
