import { Deferred, Effect } from 'effect';
import { AsyncResult, Atom, type AtomRegistry } from 'effect/reactivity';
import { microphoneSnapshotAtom } from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { createPlayback, speechStateAtom } from '@/core/speech';
import { isAssistantSpeaking, isCapturing, stopMeansCancel } from '../helpers/capture-state';
import type { ListenRequest } from '../types';
import { listenAtom, transcribeAgainAtom } from './listen';
import { discardRecording } from './recording-clip';
import {
  captureControlAtom,
  captureRequestIdAtom,
  captureStateAtom,
  captureTimingAtom,
  IDLE_CAPTURE,
  rescueHoldAtom,
  userHoldAtom,
} from './state';

const AUTO_LISTEN_STATUSES = ['opening', 'warming', 'ready'];

function canAutoListen(registry: AtomRegistry.AtomRegistry): boolean {
  if (!registry.get(conversationFlowAtom).autoListen) return false;
  const snapshot = AsyncResult.getOrElse(registry.get(microphoneSnapshotAtom), () => null);
  return snapshot !== null && AUTO_LISTEN_STATUSES.includes(snapshot.status);
}

function bumpRequestId(registry: AtomRegistry.AtomRegistry) {
  registry.update(captureRequestIdAtom, (id) => id + 1);
}

function interruptRecording(registry: AtomRegistry.AtomRegistry) {
  registry.set(listenAtom, Atom.Interrupt);
  registry.set(transcribeAgainAtom, Atom.Interrupt);
  registry.set(userHoldAtom, false);
  registry.set(rescueHoldAtom, false);
}

export function startListening(registry: AtomRegistry.AtomRegistry, request: ListenRequest) {
  if (isCapturing(registry.get(captureStateAtom))) return;
  if (request.mode === 'auto' && !canAutoListen(registry)) return;
  const playback = createPlayback(registry);
  const assistantWasSpeaking =
    request.discardPreRoll || isAssistantSpeaking(registry.get(speechStateAtom).tag);
  playback.stop();
  discardRecording(registry);
  Atom.batch(() => {
    registry.set(captureTimingAtom, {});
    bumpRequestId(registry);
    registry.set(captureStateAtom, { tag: 'requesting' });
    registry.set(listenAtom, { mode: request.mode, discardPreRoll: assistantWasSpeaking });
  });
}

export function cancelListening(registry: AtomRegistry.AtomRegistry) {
  const state = registry.get(captureStateAtom);
  const control = registry.get(captureControlAtom);
  if (control === null && state.tag !== 'requesting') return;
  bumpRequestId(registry);
  interruptRecording(registry);
  registry.set(captureStateAtom, IDLE_CAPTURE);
}

export function stopListening(registry: AtomRegistry.AtomRegistry) {
  const state = registry.get(captureStateAtom);
  const control = registry.get(captureControlAtom);
  if (control === null || state.tag !== 'recording') return;
  if (stopMeansCancel(state.heardSpeech, control.watchesTurns)) {
    cancelListening(registry);
    return;
  }
  Deferred.doneUnsafe(control.stopped, Effect.succeed('stop'));
}

export function resetCapture(registry: AtomRegistry.AtomRegistry) {
  bumpRequestId(registry);
  interruptRecording(registry);
  discardRecording(registry);
  registry.set(captureTimingAtom, {});
  registry.set(captureStateAtom, IDLE_CAPTURE);
}

export function holdListening(registry: AtomRegistry.AtomRegistry, held: boolean) {
  registry.set(userHoldAtom, held);
  registry.update(captureStateAtom, (state) =>
    state.tag === 'recording' ? { ...state, held } : state,
  );
}

export function holdForRescue(
  registry: AtomRegistry.AtomRegistry,
  recordingId: number,
  held: boolean,
) {
  const isCurrent = registry.get(captureRequestIdAtom) === recordingId;
  if (!isCurrent || registry.get(captureStateAtom).tag !== 'recording') return;
  registry.set(rescueHoldAtom, held);
}

export function transcribeAgain(registry: AtomRegistry.AtomRegistry) {
  registry.set(transcribeAgainAtom, undefined);
}
