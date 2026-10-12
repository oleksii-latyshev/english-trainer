import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError, type TranslationStatus } from '@/core/ipc';
import {
  nativeLanguageAtom,
  prepareTranslationLanguagesAtom,
  setNativeLanguageAtom,
  translationAvailabilityAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { TranslationSettingsService } from '../services/translation-settings-service';

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  language: string;
  needsDownload: boolean;
  rejectSaves: boolean;
  failStatus: boolean;
};

function statusFor(rust: FakeRust): TranslationStatus {
  return {
    native_language: rust.language,
    status: rust.needsDownload ? 'download_required' : 'installed',
    message: rust.needsDownload ? 'Prepare languages.' : 'Ready on this Mac.',
  };
}

function requestedLanguage(args: unknown): string {
  const settings: unknown = Reflect.get(Object(args), 'settings');
  return String(Reflect.get(Object(settings), 'native_language'));
}

function makeRegistry(overrides: Partial<FakeRust> = {}) {
  const rust: FakeRust = {
    calls: [],
    language: 'ru',
    needsDownload: false,
    rejectSaves: false,
    failStatus: false,
    ...overrides,
  };
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        rust.calls.push({ command, args });
        switch (command) {
          case 'get_translation_settings':
            return Effect.succeed({ native_language: rust.language });
          case 'save_translation_settings':
            if (rust.rejectSaves) {
              return Effect.fail(
                new IpcError({ code: 'database_error', message: 'Could not save locally.' }),
              );
            }
            return Effect.sync(() => {
              rust.language = requestedLanguage(args);
              return { native_language: rust.language };
            });
          case 'get_translation_status':
            if (rust.failStatus) {
              return Effect.fail(new IpcError({ code: 'unavailable', message: 'Cannot check.' }));
            }
            return Effect.sync(() => statusFor(rust));
          case 'prepare_translation_languages':
            return Effect.sync(() => {
              rust.needsDownload = false;
              return statusFor(rust);
            });
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  const layer = TranslationSettingsService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
  registry.mount(nativeLanguageAtom);
  registry.mount(translationAvailabilityAtom);
  return { registry, rust };
}

type Registry = ReturnType<typeof makeRegistry>['registry'];

function settled<A, E>(
  registry: Registry,
  atom: Parameters<typeof AtomRegistry.getResult<A, E>>[1],
) {
  return Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));
}

function callsTo(rust: FakeRust, command: string) {
  return rust.calls.filter((call) => call.command === command);
}

it('reads the saved native language and its availability from Rust', async () => {
  const { registry } = makeRegistry({ language: 'uk' });
  expect(await settled(registry, nativeLanguageAtom)).toBe('uk');
  expect((await settled(registry, translationAvailabilityAtom)).status).toBe('installed');
});

it('saves a new language and refreshes the language and its availability', async () => {
  const { registry, rust } = makeRegistry();
  await settled(registry, translationAvailabilityAtom);

  registry.set(setNativeLanguageAtom, 'de');
  await Effect.runPromise(AtomRegistry.getResult(registry, setNativeLanguageAtom));

  expect(await settled(registry, nativeLanguageAtom)).toBe('de');
  expect((await settled(registry, translationAvailabilityAtom)).native_language).toBe('de');
  expect(callsTo(rust, 'save_translation_settings')[0]?.args).toEqual({
    settings: { native_language: 'de' },
  });
});

it('keeps the shown language and reports the failure when a save is rejected', async () => {
  const { registry, rust } = makeRegistry();
  await settled(registry, nativeLanguageAtom);
  rust.rejectSaves = true;

  registry.set(setNativeLanguageAtom, 'de');
  const exit = await Effect.runPromiseExit(AtomRegistry.getResult(registry, setNativeLanguageAtom));

  expect(exit._tag).toBe('Failure');
  expect(AsyncResult.isFailure(registry.get(setNativeLanguageAtom))).toBe(true);
  expect(await settled(registry, nativeLanguageAtom)).toBe('ru');
});

it('keeps the language readable when the availability check fails', async () => {
  const { registry } = makeRegistry({ failStatus: true });
  expect(await settled(registry, nativeLanguageAtom)).toBe('ru');
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, translationAvailabilityAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcError);
});

it('prepares the languages and then reports them as ready', async () => {
  const { registry, rust } = makeRegistry({ needsDownload: true });
  expect((await settled(registry, translationAvailabilityAtom)).status).toBe('download_required');

  registry.set(prepareTranslationLanguagesAtom, undefined);
  const prepared = await Effect.runPromise(
    AtomRegistry.getResult(registry, prepareTranslationLanguagesAtom),
  );

  expect(prepared.status).toBe('installed');
  expect((await settled(registry, translationAvailabilityAtom)).status).toBe('installed');
  expect(callsTo(rust, 'prepare_translation_languages')).toHaveLength(1);
});
