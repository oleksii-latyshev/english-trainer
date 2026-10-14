import { AsyncResult, Atom } from 'effect/reactivity';
import { clipPhaseAtom, IDLE_CLIP } from '@/core/audio';
import type { TranscriptionRecovery } from '@/core/speech';
import type { ReviewPrompt } from '../helpers/review-prompt';

export type CaptureOutcome =
  | { readonly tag: 'idle' }
  | { readonly tag: 'transcribing' }
  | { readonly tag: 'microphone-failed'; readonly message: string }
  | {
      readonly tag: 'transcription-failed';
      readonly recovery: TranscriptionRecovery;
      readonly wav: Blob | null;
    };

export const IDLE_OUTCOME: CaptureOutcome = { tag: 'idle' };

export const captureOutcomeAtom = Atom.keepAlive(Atom.make<CaptureOutcome>(IDLE_OUTCOME));

export const liveTextAtom = Atom.keepAlive(Atom.make(''));

export const lastTranscriptAtom = Atom.keepAlive(Atom.make<string | null>(null));

export const frozenPromptAtom = Atom.keepAlive(Atom.make<ReviewPrompt | null>(null));

export const capturePhaseAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(clipPhaseAtom), () => IDLE_CLIP),
);
