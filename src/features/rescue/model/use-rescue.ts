import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import type { RescueKind } from '@/core/ipc';
import { rescueStateAtom } from './atoms';
import {
  chooseRescueKind,
  closeRescue,
  describeMissingWord,
  findMissingWord,
  openRescue,
  retryRescue,
  selectRescueTerm,
} from './commands';
import { rescueSurfaceAtom } from './effects';

export function useRescue() {
  const registry = useContext(RegistryContext);
  useAtomMount(rescueSurfaceAtom);
  return {
    state: useAtomValue(rescueStateAtom),
    open: () => openRescue(registry),
    close: () => closeRescue(registry),
    choose: (kind: RescueKind) => chooseRescueKind(registry, kind),
    describe: (description: string) => describeMissingWord(registry, description),
    find: () => findMissingWord(registry),
    retry: () => retryRescue(registry),
    select: (term: string) => selectRescueTerm(registry, term),
  };
}
