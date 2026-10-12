import { Effect, Schema } from 'effect';
import { IpcDecodeError, type IpcError } from './errors';
import type { IpcArgs, IpcShape } from './ipc';
import type { IpcBinaryShape, IpcHeaders } from './ipc-binary';

function decodeResult<A>(command: string, schema: Schema.Decoder<A>) {
  return (
    invoked: Effect.Effect<unknown, IpcError | IpcDecodeError>,
  ): Effect.Effect<A, IpcError | IpcDecodeError> =>
    invoked.pipe(
      Effect.flatMap((result) =>
        Schema.decodeUnknownEffect(schema)(result).pipe(
          Effect.mapError((cause) => new IpcDecodeError({ command, cause })),
        ),
      ),
    );
}

export function invokeCommand<A>(
  ipc: IpcShape,
  command: string,
  schema: Schema.Decoder<A>,
  args?: IpcArgs,
): Effect.Effect<A, IpcError | IpcDecodeError> {
  return ipc.invoke(command, args).pipe(decodeResult(command, schema));
}

export function invokeBinaryCommand<A>(
  ipc: IpcBinaryShape,
  command: string,
  schema: Schema.Decoder<A>,
  bytes: Uint8Array,
  headers?: IpcHeaders,
): Effect.Effect<A, IpcError | IpcDecodeError> {
  return ipc.invoke(command, bytes, headers).pipe(decodeResult(command, schema));
}

export function invokeUnitCommand(
  ipc: IpcShape,
  command: string,
  args?: IpcArgs,
): Effect.Effect<void, IpcError | IpcDecodeError> {
  return invokeCommand(ipc, command, Schema.Null, args).pipe(Effect.asVoid);
}
