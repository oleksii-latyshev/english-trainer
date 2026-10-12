import { AsyncResult } from 'effect/reactivity';
import type { NaturalAvailability } from '../../types';

export function naturalAvailability<E>(
  result: AsyncResult.AsyncResult<boolean, E>,
): NaturalAvailability {
  if (AsyncResult.isInitial(result) || AsyncResult.isWaiting(result)) return 'loading';
  if (AsyncResult.isFailure(result)) return 'unavailable';
  return result.value ? 'ready' : 'unavailable';
}
