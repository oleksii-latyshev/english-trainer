import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { CaptureState, ListenRequest } from '../types';
import { recordTurn } from './record';
import { keepRecording } from './recording-clip';
import { captureRuntime } from './runtime';
import { captureRequestIdAtom, captureStateAtom, IDLE_CAPTURE, recordedClipAtom } from './state';
import { transcribeRecording } from './transcribe';

export const listenAtom = Atom.keepAlive(
  captureRuntime.fn(
    Effect.fn('listen')(function* (request: ListenRequest, get: Atom.FnContext) {
      const { registry } = get;
      const requestedAtMs = performance.now();
      const recorded = yield* Effect.exit(recordTurn(get, request, requestedAtMs));
      if (recorded._tag === 'Failure') {
        const failure = recorded.cause.reasons.flatMap((reason) =>
          reason._tag === 'Fail' ? [reason.error] : [],
        )[0];
        if (failure === undefined) return;
        registry.update(
          captureStateAtom,
          (state): CaptureState => ({
            tag: 'error',
            message: failure.message,
            actualInput: state.actualInput,
          }),
        );
        return;
      }
      if (recorded.value === null) {
        registry.update(captureRequestIdAtom, (id) => id + 1);
        registry.set(captureStateAtom, IDLE_CAPTURE);
        return;
      }
      const { audio, speechStoppedAtMs } = recorded.value;
      const recording = keepRecording(registry, audio, speechStoppedAtMs);
      yield* transcribeRecording(registry, {
        recording,
        wav: audio.wav,
        actualInput: registry.get(captureStateAtom).actualInput,
      });
    }),
  ),
);

export const transcribeAgainAtom = Atom.keepAlive(
  captureRuntime.fn(
    Effect.fn('transcribeAgain')(function* (_: undefined, get: Atom.FnContext) {
      const { registry } = get;
      const state = registry.get(captureStateAtom);
      const clip = registry.get(recordedClipAtom);
      if (state.tag !== 'ready' || clip === null) return;
      yield* transcribeRecording(registry, {
        recording: {
          playbackUrl: state.playbackUrl,
          durationMs: state.durationMs,
          speechStoppedAtMs: state.speechStoppedAtMs,
        },
        wav: clip.wav,
        actualInput: state.actualInput,
      });
    }),
  ),
);
