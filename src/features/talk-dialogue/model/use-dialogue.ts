import { RegistryContext, useAtomMount, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import { createPlayback } from '@/core/speech';
import {
  coachingUpdatesAtom,
  dialogueRefreshAtom,
  dialogueViewAtom,
  visiblePendingReplyAtom,
} from './atoms';

export function useDialogue() {
  useAtomMount(coachingUpdatesAtom);
  const view = useAtomValue(dialogueViewAtom);
  const pendingReply = useAtomValue(visiblePendingReplyAtom);
  const refresh = useAtomSet(dialogueRefreshAtom);
  return { ...view, pendingReply, retry: () => refresh((tick) => tick + 1) };
}

export function useReplay() {
  const registry = useContext(RegistryContext);
  return (text: string) => createPlayback(registry).play(text);
}
