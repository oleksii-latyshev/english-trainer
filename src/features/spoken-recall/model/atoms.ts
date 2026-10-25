import { Effect } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { captureStateAtom, resetCapture } from '@/core/answer-capture';
import { recorderViewOf } from '../helpers/recorder-view';
import { SpokenRecallService } from '../services/spoken-recall-service';
import type { RecallSubmission, RecorderView, SpokenRecallResult } from '../types';
import { runtime } from './runtime';

export const recallPlanAtom = Atom.family((sessionId: number) =>
  runtime.atom(Effect.flatMap(SpokenRecallService, (service) => service.plan(sessionId))),
);

export const recallActiveAtom = Atom.make(false);

export const recallResultAtom = Atom.make<SpokenRecallResult | null>(null);

export const recallRecorderAtom = Atom.make(
  (get): RecorderView => recorderViewOf(get(captureStateAtom)),
);

export const submitRecallAtom = Atom.family((sessionId: number) =>
  runtime.fn(
    Effect.fn('submitSpokenRecall')(function* (submission: RecallSubmission, get: Atom.FnContext) {
      const service = yield* SpokenRecallService;
      const saved = yield* service.submit(sessionId, submission.phraseId, submission.transcript);
      get.refresh(recallPlanAtom(sessionId));
      yield* AtomRegistry.getResult(get.registry, recallPlanAtom(sessionId), {
        suspendOnWaiting: true,
      });
      get.set(recallResultAtom, saved);
      resetCapture(get.registry);
    }),
  ),
);
