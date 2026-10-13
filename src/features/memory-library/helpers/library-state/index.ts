import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { LearningMemory, LearningMemoryFailure } from '@/core/learning-memory';
import type { MemoryEntry } from '../../types';
import { toEntries } from '../memory-entries';

export type Library =
  | { readonly tag: 'loading' }
  | { readonly tag: 'unavailable' }
  | { readonly tag: 'ready'; readonly entries: readonly MemoryEntry[] };

export function libraryOf(
  result: AsyncResult.AsyncResult<LearningMemory, LearningMemoryFailure>,
): Library {
  const view = Option.getOrNull(AsyncResult.value(result));
  if (view) return { tag: 'ready', entries: toEntries(view) };
  return AsyncResult.isFailure(result) ? { tag: 'unavailable' } : { tag: 'loading' };
}
