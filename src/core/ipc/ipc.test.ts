import { afterEach, expect, it } from 'bun:test';
import { Effect, Exit, Schema } from 'effect';
import { IpcDecodeError, IpcError } from './errors';
import { invokeCommand, invokeUnitCommand } from './invoke-command';
import { Ipc } from './ipc';

type Internals = (command: string, args?: unknown) => Promise<unknown>;

function installFakeTauriInternals(internals: Internals) {
  Reflect.set(globalThis, 'window', { __TAURI_INTERNALS__: { invoke: internals } });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

function run<A, E>(effect: Effect.Effect<A, E, Ipc>) {
  return Effect.runPromiseExit(effect.pipe(Effect.provide(Ipc.layer)));
}

function callCommand<A>(schema: Schema.Decoder<A>) {
  return Effect.gen(function* () {
    const ipc = yield* Ipc;
    return yield* invokeCommand(ipc, 'some_command', schema, { key: 'value' });
  });
}

function failureOf<A>(exit: Exit.Exit<A, unknown>): unknown {
  if (Exit.isSuccess(exit)) return undefined;
  return exit.cause.reasons.flatMap((reason) => (reason._tag === 'Fail' ? [reason.error] : []))[0];
}

it('passes the command and arguments to Tauri and decodes the result', async () => {
  const calls: unknown[] = [];
  installFakeTauriInternals(async (command, args) => {
    calls.push([command, args]);
    return { configured: true };
  });
  const exit = await run(callCommand(Schema.Struct({ configured: Schema.Boolean })));
  expect(Exit.isSuccess(exit) && exit.value).toEqual({ configured: true });
  expect(calls).toEqual([['some_command', { key: 'value' }]]);
});

it('turns a rejected IpcError value into a tagged IpcError', async () => {
  installFakeTauriInternals(async () => {
    throw { code: 'invalid_request', message: 'Copy it again.' };
  });
  const error = failureOf(await run(callCommand(Schema.Null)));
  expect(error).toBeInstanceOf(IpcError);
  expect(error).toMatchObject({
    _tag: 'IpcError',
    code: 'invalid_request',
    message: 'Copy it again.',
  });
});

it('turns a rejection that is not an IpcError into IpcDecodeError, never a string', async () => {
  installFakeTauriInternals(async () => {
    throw 'something broke';
  });
  const error = failureOf(await run(callCommand(Schema.Null)));
  expect(error).toBeInstanceOf(IpcDecodeError);
  expect(error).toMatchObject({ _tag: 'IpcDecodeError', command: 'some_command' });
});

it('rejects an unknown error code from Rust as undecodable', async () => {
  installFakeTauriInternals(async () => {
    throw { code: 'brand_new_code', message: 'x' };
  });
  const error = failureOf(await run(callCommand(Schema.Null)));
  expect(error).toBeInstanceOf(IpcDecodeError);
});

it('fails with IpcDecodeError when the result does not match the schema', async () => {
  installFakeTauriInternals(async () => ({ configured: 'yes' }));
  const error = failureOf(await run(callCommand(Schema.Struct({ configured: Schema.Boolean }))));
  expect(error).toBeInstanceOf(IpcDecodeError);
});

it('accepts null from a command that returns nothing', async () => {
  installFakeTauriInternals(async () => null);
  const exit = await run(
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return yield* invokeUnitCommand(ipc, 'delete_something');
    }),
  );
  expect(Exit.isSuccess(exit)).toBe(true);
});
