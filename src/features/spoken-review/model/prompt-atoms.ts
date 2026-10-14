import { Atom } from 'effect/reactivity';
import { speechStateAtom } from '@/core/speech';
import { type CapturePhase, type ReviewPhase, reviewPhase } from '../helpers/review-phase';
import { type ReviewPrompt, reviewPrompt } from '../helpers/review-prompt';
import { captureOutcomeAtom, capturePhaseAtom, frozenPromptAtom } from './capture-state';
import { shownMaterialAtom } from './materials-atoms';
import { sessionAtom, shownItemAtom } from './session-atoms';

export const generatedPromptAtom = Atom.make((get): ReviewPrompt | null => {
  const item = get(shownItemAtom);
  if (item === null) return null;
  const situation = get(shownMaterialAtom)?.situation;
  const isGenerated = situation !== null && situation !== undefined;
  return reviewPrompt(item.item_type, situation ?? item.cue, isGenerated);
});

export const promptAtom = Atom.make(
  (get): ReviewPrompt | null => get(frozenPromptAtom) ?? get(generatedPromptAtom),
);

export const phaseAtom = Atom.make((get): ReviewPhase => {
  const capture: CapturePhase = get(capturePhaseAtom).tag;
  return reviewPhase({
    capture,
    isTranscribing: get(captureOutcomeAtom).tag === 'transcribing',
    isSaving: get(sessionAtom)?.pending === 'saving',
  });
});

export const isEvaSpeakingAtom = Atom.make((get) => {
  const { tag } = get(speechStateAtom);
  return tag === 'speaking' || tag === 'starting';
});

export const canReplayAtom = Atom.make((get) => get(speechStateAtom).tag !== 'unavailable');

export const spokenPromptAtom = Atom.make((get): string | null => {
  const session = get(sessionAtom);
  if (session === null || session.step.tag !== 'answering') return null;
  if (get(phaseAtom) !== 'prompt') return null;
  return get(promptAtom)?.spoken ?? null;
});
