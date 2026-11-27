import { Effect } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import {
  captureRequestIdAtom,
  captureStateAtom,
  isCapturing,
  resetCapture,
} from '@/core/answer-capture';
import { conversationFlowAtom } from '@/core/conversation-flow';
import {
  acceptTurn,
  canSendPracticeSource,
  markTurnPending,
  practiceStageUsesAudio,
  practiceStateAtom,
  reviseAcceptedTurn,
  type SessionDetails,
  sessionDetails,
} from '@/core/practice-session';
import { sendFailureOf } from '../helpers/send-failure';
import { spokenDurationMs, spokenTurn } from '../helpers/spoken-turn';
import { PracticeTurns } from '../services/practice-turn-service';
import { type SendInput, TurnBlocked } from '../types';
import { closeJoinWindow, openJoinWindow } from './continuation';
import {
  acceptedAnswerAtom,
  committedTurnAtom,
  continuationAtom,
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

function begin(
  registry: AtomRegistry.AtomRegistry,
  session: SessionDetails,
  sequence: number,
): number {
  registry.set(sendPendingAtom, true);
  markTurnPending(registry, true);
  registry.set(pendingReplyAtom, {
    sessionId: session.sessionId,
    text: '',
    savedTurnCount: sequence,
  });
  registry.update(generationAtom, (generation) => generation + 1);
  return registry.get(generationAtom);
}

function speechStoppedAt(registry: AtomRegistry.AtomRegistry): number | undefined {
  const state = registry.get(captureStateAtom);
  return state.tag === 'transcript' ? state.speechStoppedAtMs : undefined;
}

function canJoinContinuation(registry: AtomRegistry.AtomRegistry, session: SessionDetails) {
  return (
    session.practiceMode === 'voice' &&
    !session.isMistakePractice &&
    practiceStageUsesAudio(session) &&
    registry.get(conversationFlowAtom).autoListen
  );
}

function openJoinWindowAfterPause(
  registry: AtomRegistry.AtomRegistry,
  session: SessionDetails,
  input: SendInput,
  sequence: number,
) {
  if (!input.endedByPause || input.source !== 'voice') return;
  if (!canJoinContinuation(registry, session)) return;
  openJoinWindow(registry, {
    sessionId: session.sessionId,
    sequence,
    transcript: input.text,
    recordingMs: input.recordingMs,
    openedAtMs: performance.now(),
  });
}

export function sendTurn(registry: AtomRegistry.AtomRegistry, input: SendInput) {
  return Effect.gen(function* () {
    const checked = blockReason(registry, input);
    if (checked instanceof TurnBlocked) return yield* checked;
    const session = checked;
    const sequence = input.continuesTurn ?? session.turnCount + 1;
    registry.set(continuationAtom, null);
    const generation = begin(registry, session, sequence);
    closeJoinWindow(registry);
    openJoinWindowAfterPause(registry, session, input, sequence);
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
        continuesTurn: input.continuesTurn,
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
            closeJoinWindow(registry);
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
    const committed = registry.get(committedTurnAtom);
    const replacesCommitted =
      input.continuesTurn !== undefined &&
      committed?.sessionId === session.sessionId &&
      committed.sequence === input.continuesTurn;
    if (replacesCommitted) reviseAcceptedTurn(registry, session.sessionId, turn);
    else acceptTurn(registry, session.sessionId, turn);
    registry.set(committedTurnAtom, { sessionId: session.sessionId, sequence });
    registry.set(acceptedAnswerAtom, {
      sessionId: session.sessionId,
      sequence,
      originalTranscript: input.text,
      requestId,
    });
    if (!isLatest()) return turn;
    resetCapture(registry);
    voice?.finish(spokenTurn(turn));
    return turn;
  });
}
