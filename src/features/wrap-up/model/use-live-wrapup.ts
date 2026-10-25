import { useAtomMount, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { FinishedSession } from '../types';
import { wrapupAtom, wrapupUpdatesAtom } from './atoms';

export function useLiveWrapup(initial: FinishedSession): FinishedSession {
  useAtomMount(wrapupUpdatesAtom(initial.session_id));
  const latest = AsyncResult.value(useAtomValue(wrapupAtom(initial.session_id)));
  return Option.getOrElse(latest, () => initial);
}
