import { Effect, Schema } from 'effect';
import { IpcDecodeError, type IpcError } from './errors';
import type { IpcArgs, IpcShape } from './ipc';

export function invokeCommand<A>(
  ipc: IpcShape,
  command: string,
  schema: Schema.Decoder<A>,
  args?: IpcArgs,
): Effect.Effect<A, IpcError | IpcDecodeError> {
  return ipc
    .invoke(command, args)
    .pipe(
      Effect.flatMap((result) =>
        Schema.decodeUnknownEffect(schema)(result).pipe(
          Effect.mapError((cause) => new IpcDecodeError({ command, cause })),
        ),
      ),
    );
}

export function invokeUnitCommand(
  ipc: IpcShape,
  command: string,
  args?: IpcArgs,
): Effect.Effect<void, IpcError | IpcDecodeError> {
  return invokeCommand(ipc, command, Schema.Null, args).pipe(Effect.asVoid);
}
