import { Atom } from 'effect/reactivity';
import { createPlayback } from '@/core/speech';
import { spokenPromptAtom } from './prompt-atoms';

export const narrationAtom = Atom.make((get) => {
  const spoken = get(spokenPromptAtom);
  if (spoken === null) return;
  const playback = createPlayback(get.registry);
  playback.play(spoken);
  get.addFinalizer(() => playback.stop());
});
