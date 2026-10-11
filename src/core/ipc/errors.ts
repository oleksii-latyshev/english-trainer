import { Data, Schema } from 'effect';
import { IPC_ERROR_FIELDS } from './schemas/ipc-error';

export class IpcError extends Schema.TaggedError<IpcError>()('IpcError', IPC_ERROR_FIELDS) {}

export class IpcDecodeError extends Data.TaggedError('IpcDecodeError')<{
  readonly command: string;
  readonly cause: unknown;
}> {}
