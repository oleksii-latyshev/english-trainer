import { expect, it } from 'bun:test';
import { Effect, Layer, Option } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError } from '@/core/ipc';
import {
  deleteKeptRecordingsAtom,
  privacyProblemAtom,
  retentionAtom,
  setKeepRawAudioAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { PrivacyService } from '../services/privacy-service';

function makeFakeRust(options: { failSaving?: boolean } = {}) {
  const state = { keepRawAudio: false, kept: { count: 2, size_bytes: 3 * 1024 * 1024 } };
  function settings() {
    return { model_file: '', keep_raw_audio: state.keepRawAudio, live_transcript: true };
  }
  const layer = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcDecodeError> => {
        switch (command) {
          case 'get_speech_settings':
            return Effect.succeed(settings());
          case 'get_kept_recordings':
            return Effect.succeed(state.kept);
          case 'save_keep_raw_audio':
            if (options.failSaving) {
              return Effect.fail(new IpcDecodeError({ command, cause: 'rejected' }));
            }
            state.keepRawAudio = Reflect.get(args ?? {}, 'keep_raw_audio') === true;
            return Effect.succeed(settings());
          case 'delete_kept_recordings':
            state.kept = { count: 0, size_bytes: 0 };
            return Effect.succeed(state.kept);
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  return PrivacyService.layer.pipe(Layer.provide(layer), Layer.provideMerge(Reactivity.layer));
}

function makeRegistry(options?: { failSaving?: boolean }) {
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, makeFakeRust(options)]],
  });
  registry.mount(retentionAtom);
  return registry;
}

async function retention(registry: AtomRegistry.AtomRegistry) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, retentionAtom, { suspendOnWaiting: true }),
  );
}

it('reads whether audio is kept and what is kept', async () => {
  const registry = makeRegistry();
  const loaded = await retention(registry);
  expect(loaded.keepsAudio).toBe(false);
  expect(loaded.kept.count).toBe(2);
});

it('switching keep raw audio on refreshes the setting', async () => {
  const registry = makeRegistry();
  await retention(registry);
  registry.set(setKeepRawAudioAtom, true);
  await Effect.runPromise(AtomRegistry.getResult(registry, setKeepRawAudioAtom));
  expect((await retention(registry)).keepsAudio).toBe(true);
});

it('deleting kept recordings empties the list', async () => {
  const registry = makeRegistry();
  await retention(registry);
  registry.set(deleteKeptRecordingsAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, deleteKeptRecordingsAtom));
  expect((await retention(registry)).kept.count).toBe(0);
});

it('reports a save that the backend rejected', async () => {
  const registry = makeRegistry({ failSaving: true });
  await retention(registry);
  registry.mount(privacyProblemAtom);
  registry.set(setKeepRawAudioAtom, true);
  await Effect.runPromiseExit(AtomRegistry.getResult(registry, setKeepRawAudioAtom));
  expect(registry.get(privacyProblemAtom)).toEqual(Option.some('save'));
});
