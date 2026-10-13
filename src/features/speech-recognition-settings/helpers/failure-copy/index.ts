import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { type IpcDecodeError, type IpcError, ipcFailureMessage } from '@/core/ipc';

export const MODEL_SAVE_FAILED = 'The model choice could not be saved.';
export const LIVE_SAVE_FAILED = 'The live transcript setting could not be saved.';
export const DELETE_FAILED = 'The recordings could not be deleted.';
export const MEASURE_FAILED = 'The measurement could not be completed. Try again.';
export const SETTINGS_UNREADABLE = 'Speech recognition settings could not be read.';

export function settledFailureMessage<A>(
  result: AsyncResult.AsyncResult<A, IpcError | IpcDecodeError>,
  fallback: string,
): string | undefined {
  if (AsyncResult.isWaiting(result)) return undefined;
  return Option.getOrUndefined(
    Option.map(AsyncResult.error(result), (failure) => ipcFailureMessage(failure, fallback)),
  );
}
