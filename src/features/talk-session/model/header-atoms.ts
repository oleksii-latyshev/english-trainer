import { Duration, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { microphoneSnapshotAtom } from '@/core/audio';
import {
  canSendPracticeStage,
  practiceKeepsMicrophoneWarm,
  practiceStateAtom,
  sessionDetailsAtom,
} from '@/core/practice-session';
import { sendPendingAtom, speechTimingAtom, turnLockAtom } from '@/core/practice-turn';
import { pauseControl } from '../helpers/pause-control';

export const secondTickAtom = Atom.make(
  Stream.tick(Duration.seconds(1)).pipe(Stream.map(() => performance.now())),
);

export const pauseAtom = Atom.make((get) => {
  const state = get(practiceStateAtom);
  const capture = get(captureStateAtom);
  const snapshot = AsyncResult.getOrElse(get(microphoneSnapshotAtom), () => null);
  const session = get(sessionDetailsAtom);
  return pauseControl({
    micStatus: snapshot?.status ?? 'off',
    isRecording: capture.tag === 'recording',
    isTranscribing: capture.tag === 'transcribing',
    isBusy: state.tag !== 'active' || get(sendPendingAtom),
    isLocked: get(turnLockAtom) || (session !== undefined && !canSendPracticeStage(session)),
  });
});

export const keepsMicrophoneAtom = Atom.make((get) => {
  const session = get(sessionDetailsAtom);
  return session !== undefined && practiceKeepsMicrophoneWarm(session);
});

export const isActionBlockedAtom = Atom.make((get) => {
  const state = get(practiceStateAtom);
  const capture = get(captureStateAtom);
  const isCapturing =
    capture.tag === 'requesting' ||
    capture.tag === 'recording' ||
    capture.tag === 'stopping' ||
    capture.tag === 'transcribing';
  return state.tag !== 'active' || isCapturing || get(sendPendingAtom);
});

export const timingAtom = speechTimingAtom;
