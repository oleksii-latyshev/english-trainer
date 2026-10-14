import { Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  isRunFinished,
  LearningMemoryService,
  learningMemoryRuntime,
  ReviewRunService,
} from '@/core/learning-memory';
import { openSession, shownItem } from '../helpers/review-session';
import { NO_STATUS_BEFORE, statusBeforeOf } from '../helpers/status-before';
import type { OpenedReview, ReviewMode, Session } from '../types';

export const reviewModeAtom = Atom.keepAlive(Atom.make<ReviewMode>('review'));

export const summaryReachedAtom = Atom.keepAlive(Atom.make(false));

export const openedReviewAtom = learningMemoryRuntime.atom((get) => {
  const isWarmup = get.once(reviewModeAtom) === 'warmup';
  return Effect.gen(function* () {
    const reviews = yield* ReviewRunService;
    const memory = yield* LearningMemoryService;
    const [run, statusBefore] = yield* Effect.all(
      [
        reviews.start(isWarmup),
        memory.read.pipe(
          Effect.map(statusBeforeOf),
          Effect.catch(() => Effect.succeed(NO_STATUS_BEFORE)),
        ),
      ],
      { concurrency: 'unbounded' },
    );
    return { run, statusBefore } satisfies OpenedReview;
  });
});

export const sessionAtom = Atom.writable(
  (get): Session | null => {
    const opened = Option.getOrNull(AsyncResult.value(get(openedReviewAtom)));
    return opened?.run ? openSession(opened.run) : null;
  },
  (context, next: Session | null) => context.setSelf(next),
);

export type ReviewView =
  | { readonly tag: 'loading' }
  | { readonly tag: 'error' }
  | { readonly tag: 'nothing' }
  | { readonly tag: 'ready' };

export const reviewViewAtom = Atom.make((get): ReviewView => {
  const opened = get(openedReviewAtom);
  if (AsyncResult.isFailure(opened)) return { tag: 'error' };
  if (!AsyncResult.isSuccess(opened)) return { tag: 'loading' };
  return opened.value.run === null ? { tag: 'nothing' } : { tag: 'ready' };
});

export const statusBeforeAtom = Atom.make((get) => {
  const opened = Option.getOrNull(AsyncResult.value(get(openedReviewAtom)));
  return opened?.statusBefore ?? NO_STATUS_BEFORE;
});

export const shownItemAtom = Atom.make((get) => {
  const session = get(sessionAtom);
  return session === null ? null : shownItem(session);
});

export const isWarmupAtom = Atom.make((get) => get(reviewModeAtom) === 'warmup');

export const isRunFinishedAtom = Atom.make((get) => {
  const session = get(sessionAtom);
  return session !== null && isRunFinished(session.run.items);
});

export const warmupHandoffAtom = Atom.make(
  (get) => get(reviewModeAtom) === 'warmup' && get(summaryReachedAtom),
);
