import { Effect } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import {
  captureRequestIdAtom,
  captureStateAtom,
  isCapturing,
  resetCapture,
} from '@/core/answer-capture';
import {
  acceptTurn,
  canSendPracticeSource,
  markTurnPending,
  practiceStageUsesAudio,
  practiceStateAtom,
  type SessionDetails,
  sessionDetails,
} from '@/core/practice-session';
import { sendFailureOf } from '../helpers/send-failure';
import { spokenDurationMs, spokenTurn } from '../helpers/spoken-turn';
import { PracticeTurns } from '../services/practice-turn-service';
import { type SendInput, TurnBlocked } from '../types';
import {
  acceptedAnswerAtom,
  generationAtom,
  outcomeRecordAtom,
  pendingReplyAtom,
  sendPendingAtom,
  turnLockAtom,
} from './state';
import { beginReplyVoice } from './voice';

function blockReason(
  registry: AtomRegistry.AtomRegistry,
  input: SendInput,
): TurnBlocked | SessionDetails {
  const state = registry.get(practiceStateAtom);
  const session = state.tag === 'active' ? sessionDetails(state) : undefined;
  const isBusy =
    session === undefined ||
    registry.get(sendPendingAtom) ||
    registry.get(turnLockAtom) ||
    isCapturing(registry.get(captureStateAtom));
  if (isBusy) return new TurnBlocked({ reason: 'busy' });
  if (!canSendPracticeSource(session, input.source)) return new TurnBlocked({ reason: 'stage' });
  if (!input.text.trim()) return new TurnBlocked({ reason: 'empty' });
  return session;
}

function begin(registry: AtomRegistry.AtomRegistry, session: SessionDetails): number {
  registry.set(sendPendingAtom, true);
  markTurnPending(registry, true);
  registry.set(pendingReplyAtom, {
    sessionId: session.sessionId,
    text: '',
    savedTurnCount: session.turnCount + 1,
  });
  registry.update(generationAtom, (generation) => generation + 1);
  return registry.get(generationAtom);
}

function speechStoppedAt(registry: AtomRegistry.AtomRegistry): number | undefined {
  const state = registry.get(captureStateAtom);
  return state.tag === 'transcript' ? state.speechStoppedAtMs : undefined;
}

export function sendTurn(registry: AtomRegistry.AtomRegistry, input: SendInput) {
  return Effect.gen(function* () {
    const checked = blockReason(registry, input);
    if (checked instanceof TurnBlocked) return yield* checked;
    const session = checked;
    const generation = begin(registry, session);
    function isLatest() {
      return registry.get(generationAtom) === generation;
    }
    const sentAtMs = performance.now();
    const voice = practiceStageUsesAudio(session)
      ? beginReplyVoice(registry, {
          session,
          generation,
          sentAtMs,
          speechStoppedAtMs: speechStoppedAt(registry),
        })
      : null;
    const requestId = registry.get(captureRequestIdAtom);
    const turns = yield* PracticeTurns;
    const turn = yield* turns
      .send({
        sessionId: session.sessionId,
        transcript: input.text,
        source: input.source,
        answerDurationMs: spokenDurationMs(input.source, input.recordingMs),
        onDelta: (text) => {
          if (!isLatest()) return;
          registry.update(pendingReplyAtom, (reply) =>
            reply?.sessionId === session.sessionId ? { ...reply, text: reply.text + text } : reply,
          );
          voice?.append(text);
        },
      })
      .pipe(
        Effect.tapError((failure) =>
          Effect.sync(() => {
            voice?.cancel();
            if (!isLatest()) return;
            registry.set(pendingReplyAtom, null);
            registry.set(outcomeRecordAtom, {
              requestId,
              outcome: { tag: 'failed', failure: sendFailureOf(failure) },
            });
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            if (!isLatest()) return;
            registry.set(sendPendingAtom, false);
            markTurnPending(registry, false);
          }),
        ),
      );
    acceptTurn(registry, session.sessionId, turn);
    registry.set(acceptedAnswerAtom, {
      sessionId: session.sessionId,
      sequence: session.turnCount + 1,
      originalTranscript: input.text,
      requestId,
    });
    if (!isLatest()) return turn;
    resetCapture(registry);
    voice?.finish(spokenTurn(turn));
    return turn;
  });
}
