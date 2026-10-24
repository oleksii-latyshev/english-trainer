import { Effect, Stream } from 'effect';
import { Atom } from 'effect/reactivity';
import { captureStateAtom, resetCapture } from '@/core/answer-capture';
import { ipcFailureMessage } from '@/core/ipc';
import { answerKey } from '../helpers/answer-key';
import { type CapturePhase, capturePhaseOf } from '../helpers/capture-phase';
import { CoachingNoteService } from '../services/coaching-note-service';
import type { AnswerTarget, AttemptComparison, SayAgainView } from '../types';
import { runtime } from './runtime';

const COMPARE_FAILED = 'Could not compare this attempt. Please retry.';

export const conversationAtom = Atom.family((sessionId: number) =>
  runtime.atom(
    Effect.flatMap(CoachingNoteService, (service) => service.readConversation(sessionId)),
  ),
);

export const conversationUpdatesAtom = Atom.family((sessionId: number) =>
  runtime.atom((get) =>
    Effect.flatMap(CoachingNoteService, (service) =>
      Stream.runForEach(service.coachingUpdates(sessionId), () =>
        Effect.sync(() => get.registry.refresh(conversationAtom(sessionId))),
      ),
    ),
  ),
);

export const retryCoachingAtom = Atom.family((_key: string) =>
  runtime.fn(
    Effect.fn('retryCoaching')(function* (target: AnswerTarget, get: Atom.FnContext) {
      const service = yield* CoachingNoteService;
      yield* service.retryCoaching(target.sessionId, target.sequence);
      get.refresh(conversationAtom(target.sessionId));
    }),
  ),
);

const secondTriesAtom = Atom.keepAlive(
  Atom.make<ReadonlyMap<string, AttemptComparison>>(new Map()),
);

export const secondTryAtom = Atom.family((key: string) =>
  Atom.make((get) => get(secondTriesAtom).get(key)),
);

export const sayAgainTargetAtom = Atom.keepAlive(Atom.make<AnswerTarget | null>(null));

export const compareFailureAtom = Atom.keepAlive(Atom.make<string | null>(null));

export const sayAgainActiveAtom = Atom.make((get) => get(sayAgainTargetAtom) !== null);

const capturePhaseAtom = Atom.make((get): CapturePhase => capturePhaseOf(get(captureStateAtom)));

const captureProblemAtom = Atom.make((get): string => {
  const capture = get(captureStateAtom);
  if (capture.tag === 'error') return capture.failure?.message ?? capture.message;
  if (capture.tag === 'ready') return capture.failure?.message ?? '';
  return '';
});

const transcriptAtom = Atom.make((get): string => {
  const capture = get(captureStateAtom);
  return capture.tag === 'transcript' ? capture.text.trim() : '';
});

export const sayAgainEffectsAtom = runtime.atom((get) => {
  const target = get(sayAgainTargetAtom);
  const transcript = get(transcriptAtom);
  if (target === null || transcript === '') return Effect.void;
  return Effect.gen(function* () {
    const service = yield* CoachingNoteService;
    get.registry.set(compareFailureAtom, null);
    const comparison = yield* service
      .compareSecondTry(target.sessionId, target.sequence, transcript)
      .pipe(
        Effect.tapError((failure) =>
          Effect.sync(() => {
            get.registry.set(compareFailureAtom, ipcFailureMessage(failure, COMPARE_FAILED));
            resetCapture(get.registry);
          }),
        ),
      );
    get.registry.update(secondTriesAtom, (known) =>
      new Map(known).set(answerKey(target), comparison),
    );
    get.registry.set(sayAgainTargetAtom, null);
    resetCapture(get.registry);
  }).pipe(Effect.ignore);
});

export const sayAgainViewAtom = Atom.family((key: string) =>
  Atom.make((get): SayAgainView => {
    const target = get(sayAgainTargetAtom);
    if (target === null) return { tag: 'idle' };
    if (answerKey(target) !== key) return { tag: 'busy' };
    const phase = get(capturePhaseAtom);
    switch (phase) {
      case 'requesting':
        return { tag: 'requesting' };
      case 'capturing':
        return { tag: 'capturing' };
      case 'transcribing':
        return { tag: 'transcribing' };
      case 'comparing':
        return { tag: 'comparing' };
      case 'kept':
        return { tag: 'failed', message: get(captureProblemAtom), canRetryTranscription: true };
      case 'idle': {
        const message = get(captureProblemAtom) || get(compareFailureAtom);
        return message ? { tag: 'failed', message, canRetryTranscription: false } : { tag: 'idle' };
      }
      case 'failed':
        return { tag: 'failed', message: get(captureProblemAtom), canRetryTranscription: false };
    }
  }),
);
