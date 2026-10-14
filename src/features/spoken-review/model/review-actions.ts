import { Effect, Exit } from 'effect';
import { Atom } from 'effect/reactivity';
import { LEARNING_MEMORY, learningMemoryRuntime, ReviewRunService } from '@/core/learning-memory';
import {
  begin,
  fail,
  isFinished,
  nextItem,
  pendingItem,
  settle,
  skipped,
} from '../helpers/review-session';
import { cancelAnswer, forgetFrozenPrompt, resetAnswer, stopSpeech } from './answer-controls';
import { finishRun } from './finish';
import { sessionAtom } from './session-atoms';

export const nextAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('next')(function* (_: undefined, get: Atom.FnContext) {
      const { registry } = get;
      cancelAnswer(registry);
      forgetFrozenPrompt(registry);
      const session = registry.get(sessionAtom);
      if (session === null) return;
      if (isFinished(session)) yield* finishRun(registry);
      else registry.set(sessionAtom, nextItem(session));
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

export const skipAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('skip')(function* (_: undefined, get: Atom.FnContext) {
      const { registry } = get;
      const session = registry.get(sessionAtom);
      const item = session === null ? null : pendingItem(session);
      if (session === null || item === null || session.pending !== 'none') return;
      resetAnswer(registry);
      forgetFrozenPrompt(registry);
      stopSpeech(registry);
      registry.set(sessionAtom, begin(session, 'skipping'));
      const service = yield* ReviewRunService;
      const exit = yield* Effect.exit(
        service.skip({ runId: session.run.run_id, itemType: item.item_type, itemId: item.item_id }),
      );
      const latest = registry.get(sessionAtom);
      if (latest === null) return;
      if (Exit.isFailure(exit)) {
        registry.set(sessionAtom, fail(latest, 'skip'));
        return;
      }
      const afterSkip = skipped(latest, exit.value);
      registry.set(sessionAtom, afterSkip);
      if (isFinished(afterSkip)) yield* finishRun(registry);
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

export const finishAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('finish')(function* (_: undefined, get: Atom.FnContext) {
      yield* finishRun(get.registry);
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

export const endReviewAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('endReview')(function* (onDone: () => void, get: Atom.FnContext) {
      const { registry } = get;
      cancelAnswer(registry);
      stopSpeech(registry);
      const session = registry.get(sessionAtom);
      if (session === null || session.pending !== 'none') return;
      registry.set(sessionAtom, begin(session, 'finishing'));
      const service = yield* ReviewRunService;
      const exit = yield* Effect.exit(service.finish(session.run.run_id));
      const latest = registry.get(sessionAtom);
      if (latest === null) return;
      if (Exit.isFailure(exit)) {
        registry.set(sessionAtom, fail(latest, 'finish'));
        return;
      }
      registry.set(sessionAtom, settle(latest));
      onDone();
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);
