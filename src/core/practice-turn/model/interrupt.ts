import { Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { captureRequestIdAtom, startListening } from '@/core/answer-capture';
import { markTurnPending, practiceStateAtom, sessionDetails } from '@/core/practice-session';
import { createPlayback, speechStateAtom } from '@/core/speech';
import { sendFailureOf } from '../helpers/send-failure';
import { PracticeTurns } from '../services/practice-turn-service';
import { turnRuntime } from './runtime';
import {
  acceptedAnswerAtom,
  generationAtom,
  IDLE_OUTCOME,
  interruptingAtom,
  outcomeRecordAtom,
  pendingReplyAtom,
  replyVoiceAtom,
  sendPendingAtom,
} from './state';

export type InterruptRequest = {
  readonly record: boolean;
  readonly retainPreRoll: boolean;
};

const SPEAKING_TAGS: readonly string[] = ['speaking', 'starting', 'paused'];

export function resetTurnState(registry: AtomRegistry.AtomRegistry) {
  registry.set(pendingReplyAtom, null);
  registry.set(acceptedAnswerAtom, null);
  registry.set(outcomeRecordAtom, IDLE_OUTCOME);
}

export function discardPendingReply(registry: AtomRegistry.AtomRegistry) {
  registry.update(generationAtom, (generation) => generation + 1);
  registry.get(replyVoiceAtom)?.cancel();
  createPlayback(registry).stop();
  registry.set(sendPendingAtom, false);
  resetTurnState(registry);
}

export const interruptReplyAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('interruptReply')(function* (request: InterruptRequest, get: Atom.FnContext) {
      const { registry } = get;
      if (registry.get(interruptingAtom)) return;
      registry.set(interruptingAtom, true);
      const wasSpeaking = SPEAKING_TAGS.includes(registry.get(speechStateAtom).tag);
      registry.update(generationAtom, (generation) => generation + 1);
      const generation = registry.get(generationAtom);
      registry.get(replyVoiceAtom)?.cancel();
      createPlayback(registry).stop();
      const sessionId = sessionDetails(registry.get(practiceStateAtom))?.sessionId;
      const turns = yield* PracticeTurns;
      const cancelled = yield* Effect.exit(
        registry.get(sendPendingAtom) && sessionId !== undefined
          ? turns.cancel(sessionId)
          : Effect.succeed(false),
      ).pipe(Effect.ensuring(Effect.sync(() => registry.set(interruptingAtom, false))));
      if (registry.get(generationAtom) !== generation) return;
      if (cancelled._tag === 'Failure') {
        const failure = cancelled.cause.reasons.flatMap((reason) =>
          reason._tag === 'Fail' ? [reason.error] : [],
        )[0];
        if (failure === undefined) return;
        registry.set(outcomeRecordAtom, {
          requestId: registry.get(captureRequestIdAtom),
          outcome: { tag: 'failed', failure: sendFailureOf(failure) },
        });
        return;
      }
      registry.set(sendPendingAtom, false);
      markTurnPending(registry, false);
      resetTurnState(registry);
      if (request.record) {
        startListening(registry, {
          mode: 'manual',
          discardPreRoll: wasSpeaking && !request.retainPreRoll,
        });
      }
    }),
    { concurrent: true },
  ),
);

export function interruptReply(registry: AtomRegistry.AtomRegistry, request: InterruptRequest) {
  registry.set(interruptReplyAtom, request);
}
