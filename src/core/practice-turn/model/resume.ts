import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { turnRuntime } from './runtime';
import { sendTurn } from './send';
import { continuationAtom } from './state';

const resumeAnswerAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('resumeAnswer')(function* (
      input: Parameters<typeof sendTurn>[1],
      get: Atom.FnContext,
    ) {
      yield* Effect.ignore(sendTurn(get.registry, input));
    }),
    { concurrent: true },
  ),
);

export const resumeAbandonedAnswerAtom = Atom.make((get) => {
  const continuation = get(continuationAtom);
  const capture = get(captureStateAtom);
  if (continuation === null || (capture.tag !== 'idle' && capture.tag !== 'error')) return;
  get.registry.set(continuationAtom, null);
  get.registry.set(resumeAnswerAtom, {
    text: continuation.transcript,
    source: 'voice',
    recordingMs: continuation.recordingMs,
    continuesTurn: continuation.sequence,
  });
});
