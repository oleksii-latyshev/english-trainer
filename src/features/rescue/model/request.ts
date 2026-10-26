import { Effect } from 'effect';
import { type Atom, AtomRegistry } from 'effect/reactivity';
import { rescueTranscriptAtom } from '@/core/answer-capture';
import { RescueService } from '../services/rescue-service';
import type { RescueAnswer, RescueFailure, RescueRequestInput, RescueState } from '../types';
import { rescueEntryAtom, rescueGenerationAtom, rescueTargetAtom } from './atoms';
import { releaseHold } from './hold';
import { runtime } from './runtime';

export type RunningRescue = RescueRequestInput & { readonly generation: number };

function isLive(registry: AtomRegistry.AtomRegistry, running: RunningRescue): boolean {
  return (
    registry.get(rescueGenerationAtom) === running.generation &&
    registry.get(rescueTargetAtom)?.key === running.target.key
  );
}

function transcribe(registry: AtomRegistry.AtomRegistry, running: RunningRescue) {
  const { target } = running;
  return Effect.suspend(() => {
    registry.set(rescueTranscriptAtom, {
      recordingId: target.recordingId,
      sessionId: target.sessionId,
      sequence: target.sequence,
    });
    return AtomRegistry.getResult(registry, rescueTranscriptAtom, { suspendOnWaiting: true });
  });
}

export const requestRescueAtom = runtime.fn(
  Effect.fn('requestRescue')(function* (running: RunningRescue, get: Atom.FnContext) {
    const service = yield* RescueService;
    const { registry } = get;
    get.mount(rescueTranscriptAtom);
    const { target, kind, description } = running;

    function show(state: RescueState) {
      registry.set(rescueEntryAtom, { key: target.key, state });
    }
    function answered(answer: RescueAnswer) {
      return Effect.sync(() => {
        if (isLive(registry, running)) show({ tag: 'answer', kind, description, answer });
      });
    }
    function failed(failure: RescueFailure) {
      return Effect.sync(() => {
        if (!isLive(registry, running)) return;
        releaseHold(registry);
        show({ tag: 'error', kind, description, failure });
      });
    }

    yield* Effect.gen(function* () {
      const partialTranscript = kind === 'missing_word' ? '' : yield* transcribe(registry, running);
      if (!isLive(registry, running)) return null;
      return yield* service.answer(running, partialTranscript);
    }).pipe(
      Effect.matchEffect({
        onSuccess: (answer) => (answer === null ? Effect.void : answered(answer)),
        onFailure: failed,
      }),
    );
  }),
);
