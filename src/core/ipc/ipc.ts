import { invoke } from '@tauri-apps/api/core';
import { Context, Data, Effect, Layer, Schema } from 'effect';
import { IpcDecodeError, IpcError } from './errors';
import { IpcErrorSchema } from './schemas/ipc-error';

export type IpcArgs = Readonly<Record<string, unknown>>;

export type IpcShape = {
  readonly invoke: (
    command: string,
    args?: IpcArgs,
  ) => Effect.Effect<unknown, IpcError | IpcDecodeError>;
};

export class Ipc extends Context.Service<Ipc, IpcShape>()('core/ipc/Ipc') {
  static readonly layer = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.tryPromise({
        try: () => invoke<unknown>(command, args === undefined ? undefined : { ...args }),
        catch: (rejection) => new IpcRejection({ rejection }),
      }).pipe(
        Effect.catchTag('IpcRejection', ({ rejection }) =>
          failWithDecodedRejection(command, rejection),
        ),
      ),
  });
}

export class IpcRejection extends Data.TaggedError('IpcRejection')<{
  readonly rejection: unknown;
}> {}

export function failWithDecodedRejection(command: string, rejection: unknown) {
  return Schema.decodeUnknownEffect(IpcErrorSchema)(rejection).pipe(
    Effect.mapError((cause) => new IpcDecodeError({ command, cause })),
    Effect.flatMap((fields) => Effect.fail(new IpcError(fields))),
  );
}
