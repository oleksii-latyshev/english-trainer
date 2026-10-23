import { Atom } from 'effect/reactivity';
import { holdKeptOpenAtom, keyboardAtom } from './keyboard';
import { adoptExistingTranscriptAtom, countdownScopeAtom, transcriptSyncAtom } from './sync';

export const composerEffectsAtom = Atom.make((get) => {
  get.mount(adoptExistingTranscriptAtom);
  get.mount(transcriptSyncAtom);
  get.mount(countdownScopeAtom);
  get.mount(keyboardAtom);
  get.mount(holdKeptOpenAtom);
});
