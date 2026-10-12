import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError, type PersonalProfile } from '@/core/ipc';
import { ProfileTooLong } from '../errors';
import { personalProfileAtom, profileDraftAtom, savePersonalProfileAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { PersonalProfileService } from '../services/personal-profile-service';

const EMPTY: PersonalProfile = { role: '', stack: '', interests: '', goals: '' };

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  stored: unknown;
  rejectSaves: boolean;
};

function makeRegistry(initial: unknown = EMPTY) {
  const rust: FakeRust = { calls: [], stored: initial, rejectSaves: false };
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        rust.calls.push({ command, args });
        switch (command) {
          case 'get_personal_profile':
            return Effect.sync((): unknown => rust.stored);
          case 'save_personal_profile':
            if (rust.rejectSaves) {
              return Effect.fail(
                new IpcError({ code: 'database_error', message: 'Could not save locally.' }),
              );
            }
            return Effect.sync(() => {
              rust.stored = Reflect.get(args ?? {}, 'profile');
              return rust.stored;
            });
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
        }
      }),
  });
  const layer = PersonalProfileService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
  registry.mount(personalProfileAtom);
  return { registry, rust };
}

type Registry = ReturnType<typeof makeRegistry>['registry'];

function settledProfile(registry: Registry) {
  return Effect.runPromise(
    AtomRegistry.getResult(registry, personalProfileAtom, { suspendOnWaiting: true }),
  );
}

it('reads the stored profile from Rust', async () => {
  const stored = { ...EMPTY, role: 'Engineer', stack: 'Rust, Tauri' };
  const { registry } = makeRegistry(stored);
  expect(await settledProfile(registry)).toEqual(stored);
});

it('saves the profile and shows the stored result', async () => {
  const { registry, rust } = makeRegistry();
  await settledProfile(registry);
  const edited = { ...EMPTY, goals: 'Speak up in stand-ups' };

  registry.set(profileDraftAtom, edited);
  registry.set(savePersonalProfileAtom, edited);
  await Effect.runPromise(AtomRegistry.getResult(registry, savePersonalProfileAtom));

  expect(registry.get(profileDraftAtom)).toBeNull();

  expect(await settledProfile(registry)).toEqual(edited);
  expect(rust.calls.find((call) => call.command === 'save_personal_profile')?.args).toEqual({
    profile: edited,
  });
});

it('keeps the shown profile and reports the failure when a save is rejected', async () => {
  const { registry, rust } = makeRegistry();
  await settledProfile(registry);
  rust.rejectSaves = true;

  const draft = { ...EMPTY, role: 'Engineer' };
  registry.set(profileDraftAtom, draft);
  registry.set(savePersonalProfileAtom, draft);
  const exit = await Effect.runPromiseExit(
    AtomRegistry.getResult(registry, savePersonalProfileAtom),
  );

  expect(exit._tag).toBe('Failure');
  expect(AsyncResult.isFailure(registry.get(savePersonalProfileAtom))).toBe(true);
  expect(registry.get(profileDraftAtom)).toEqual(draft);
  expect(await settledProfile(registry)).toEqual(EMPTY);
});

it('does not call Rust for a field over the limit', async () => {
  const { registry, rust } = makeRegistry();
  await settledProfile(registry);

  registry.set(savePersonalProfileAtom, { ...EMPTY, goals: 'x'.repeat(151) });
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, savePersonalProfileAtom).pipe(Effect.flip),
  );

  expect(failure).toBeInstanceOf(ProfileTooLong);
  expect(rust.calls.map((call) => call.command)).not.toContain('save_personal_profile');
});

it('fails with IpcDecodeError when Rust answers with a field of the wrong type', async () => {
  const { registry } = makeRegistry({ ...EMPTY, goals: null });
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, personalProfileAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});
