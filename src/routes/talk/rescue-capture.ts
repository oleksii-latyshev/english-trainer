import { Cause, Effect, Exit } from 'effect';
import { type AtomRegistry, AtomRegistry as Registry } from 'effect/reactivity';
import { holdForRescue, rescueTranscriptAtom } from '@/core/answer-capture';
import type { RescueCapture } from '@/features/practice/useRescue';

export function rescueCaptureOf(registry: AtomRegistry.AtomRegistry): RescueCapture {
  return {
    holdForRescue: (recordingId, held) => holdForRescue(registry, recordingId, held),
    rescueTranscript: async (recordingId, sessionId, sequence) => {
      registry.mount(rescueTranscriptAtom);
      registry.set(rescueTranscriptAtom, { recordingId, sessionId, sequence });
      const exit = await Effect.runPromiseExit(
        Registry.getResult(registry, rescueTranscriptAtom, { suspendOnWaiting: true }),
      );
      if (Exit.isSuccess(exit)) return exit.value;
      throw Cause.squash(exit.cause);
    },
  };
}
