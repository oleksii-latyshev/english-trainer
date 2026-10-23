import { Effect } from 'effect';
import type { Atom } from 'effect/reactivity';
import { IpcError } from '@/core/ipc';
import { rescueTranscript } from '@/core/speech';
import { captureRuntime } from './runtime';
import { captureControlAtom, captureRequestIdAtom, captureStateAtom } from './state';

const RESCUE_TAIL_MS = 15_000;
const RECORDING_CHANGED = 'Recording changed. Open Stuck during your current answer.';

export type RescueRequest = {
  readonly recordingId: number;
  readonly sessionId: number;
  readonly sequence: number;
};

export const rescueTranscriptAtom = captureRuntime.fn(
  Effect.fn('rescueTranscript')(function* (request: RescueRequest, get: Atom.FnContext) {
    const { registry } = get;
    const changed = new IpcError({ code: 'cancelled', message: RECORDING_CHANGED });
    function isCurrent() {
      return (
        registry.get(captureRequestIdAtom) === request.recordingId &&
        registry.get(captureStateAtom).tag === 'recording'
      );
    }
    const control = registry.get(captureControlAtom);
    if (control === null || !isCurrent()) return yield* changed;
    const text = yield* rescueTranscript(control.capture.snapshot({ tailMs: RESCUE_TAIL_MS }), {
      sessionId: request.sessionId,
      sequence: request.sequence,
    });
    if (!isCurrent()) return yield* changed;
    return text;
  }),
);
