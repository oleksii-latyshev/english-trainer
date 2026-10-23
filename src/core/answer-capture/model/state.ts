import type { Deferred } from 'effect';
import { Atom } from 'effect/reactivity';
import type { Capture } from '@/core/audio';
import type { SpeechTiming } from '@/core/speech';
import { canChangeSession } from '../helpers/capture-state';
import type { CaptureState } from '../types';

export type CaptureControl = {
  readonly stopped: Deferred.Deferred<'stop' | 'cancel'>;
  readonly capture: Capture;
  readonly watchesTurns: boolean;
};

export type RecordedClip = {
  readonly wav: Blob;
  readonly playbackUrl: string;
};

export const IDLE_CAPTURE: CaptureState = { tag: 'idle' };

export const captureStateAtom = Atom.keepAlive(Atom.make<CaptureState>(IDLE_CAPTURE));

export const captureTimingAtom = Atom.keepAlive(Atom.make<SpeechTiming>({}));

export const captureRequestIdAtom = Atom.keepAlive(Atom.make(0));

export const recordedClipAtom = Atom.keepAlive(Atom.make<RecordedClip | null>(null));

export const captureControlAtom = Atom.keepAlive(Atom.make<CaptureControl | null>(null));

export const userHoldAtom = Atom.keepAlive(Atom.make(false));

export const rescueHoldAtom = Atom.keepAlive(Atom.make(false));

export const turnHeldOpenAtom = Atom.make((get) => get(userHoldAtom) || get(rescueHoldAtom));

export const canChangeSessionAtom = Atom.make((get) => canChangeSession(get(captureStateAtom)));
