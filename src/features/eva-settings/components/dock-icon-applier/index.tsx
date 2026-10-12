import { useAtomMount } from '@effect/atom-react';
import { dockIconSyncAtom } from '../../model/atoms';

export function DockIconApplier() {
  useAtomMount(dockIconSyncAtom);
  return null;
}
