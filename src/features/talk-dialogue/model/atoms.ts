import { Effect, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { sessionDetailsAtom } from '@/core/practice-session';
import { pendingReplyAtom } from '@/core/practice-turn';
import { FOLLOWING, type FollowState } from '../helpers/follow-scroll';
import { DialogueService } from '../services/dialogue-service';
import type { DialogueView } from '../types';
import { runtime } from './runtime';

const NO_DIALOGUE: DialogueView = { dialogue: null, hasFailed: false };

export const dialogueRefreshAtom = Atom.keepAlive(Atom.make(0));

const openSessionIdAtom = Atom.make((get) => get(sessionDetailsAtom)?.sessionId);

const dialogueKeyAtom = Atom.make((get) => {
  const session = get(sessionDetailsAtom);
  if (session === undefined) return null;
  return `${session.turnCount}:${session.question}:${session.practiceMode}:${session.practicePhase}`;
});

const sessionDialogueAtom = Atom.family((sessionId: number) =>
  runtime.atom((get) => {
    get(dialogueKeyAtom);
    get(dialogueRefreshAtom);
    return Effect.flatMap(DialogueService, (service) => service.read(sessionId));
  }),
);

export const coachingUpdatesAtom = runtime.atom((get) => {
  const sessionId = get(openSessionIdAtom);
  if (sessionId === undefined) return Effect.void;
  return Effect.flatMap(DialogueService, (service) =>
    Stream.runForEach(service.coachingUpdates(sessionId), () =>
      Effect.sync(() => get.registry.update(dialogueRefreshAtom, (tick) => tick + 1)),
    ),
  );
});

export const dialogueViewAtom = Atom.make((get): DialogueView => {
  const sessionId = get(openSessionIdAtom);
  if (sessionId === undefined) return NO_DIALOGUE;
  const result = get(sessionDialogueAtom(sessionId));
  const value = AsyncResult.value(result);
  return {
    dialogue: value._tag === 'Some' ? value.value : null,
    hasFailed: AsyncResult.isFailure(result),
  };
});

export const visiblePendingReplyAtom = Atom.make((get): string | undefined => {
  const reply = get(pendingReplyAtom);
  const sessionId = get(openSessionIdAtom);
  const savedTurns = get(dialogueViewAtom).dialogue?.turns.length ?? 0;
  const isUnsaved =
    reply !== null && reply.sessionId === sessionId && savedTurns < reply.savedTurnCount;
  return isUnsaved ? reply.text : undefined;
});

export const followStateAtom = Atom.make<FollowState>(FOLLOWING);
