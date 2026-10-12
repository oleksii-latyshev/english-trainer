import { invoke } from '@tauri-apps/api/core';
import { Context, Effect, Layer } from 'effect';
import type { IpcDecodeError, IpcError } from './errors';
import { failWithDecodedRejection, IpcRejection } from './ipc';

export type IpcHeaders = Readonly<Record<string, string>>;

export type IpcBinaryShape = {
  readonly invoke: (
    command: string,
    bytes: Uint8Array,
    headers?: IpcHeaders,
  ) => Effect.Effect<unknown, IpcError | IpcDecodeError>;
};

export class IpcBinary extends Context.Service<IpcBinary, IpcBinaryShape>()('core/ipc/IpcBinary') {
  static readonly layer = Layer.succeed(IpcBinary, {
    invoke: (command, bytes, headers) =>
      Effect.tryPromise({
        try: () => invoke<unknown>(command, bytes, headers === undefined ? undefined : { headers }),
        catch: (rejection) => new IpcRejection({ rejection }),
      }).pipe(
        Effect.catchTag('IpcRejection', ({ rejection }) =>
          failWithDecodedRejection(command, rejection),
        ),
      ),
  });
}
