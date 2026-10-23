import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import { draftAtom, isSendingAtom } from './draft-atoms';
import { composerEffectsAtom } from './effects';
import { levelAtom, presentationAtom, turnStateAtom } from './view-atoms';

export function useComposerEffects() {
  useAtomMount(composerEffectsAtom);
}

export function useComposerRegistry() {
  return useContext(RegistryContext);
}

export function useTurn() {
  return {
    state: useAtomValue(turnStateAtom),
    presentation: useAtomValue(presentationAtom),
    level: useAtomValue(levelAtom),
    draft: useAtomValue(draftAtom),
    isSending: useAtomValue(isSendingAtom),
  };
}
