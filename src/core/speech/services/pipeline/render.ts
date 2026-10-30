import { Cause, Clock, Data, Effect, Queue, Ref, Schedule } from 'effect';
import type { DiagnosticEvent } from '@/core/diagnostics';
import { cutPhrase, FIRST_PHRASE_BUDGET, laterPhraseBudget } from '../../helpers/phrase-plan';
import { BUSY_RETRY_MS, INITIAL_SYNTHESIS_ESTIMATE } from '../../helpers/speech-timing';
import {
  observeSynthesis,
  pauseBeforeMs,
  renderDelayMs,
  type SynthesisEstimate,
  synthesisGuardMs,
} from '../../helpers/synthesis-pacing';
import type { NaturalVoiceFailure } from '../../types';
import type { ClipHandle } from '../audio-output-service';
import { takeSentence } from './intake';
import { markStarted, type NaturalOutput, type Pipeline, type TextState } from './pipeline';

type FallbackReason = Extract<DiagnosticEvent, { kind: 'natural_voice_fallback' }>['reason'];

export type RenderState = {
  readonly estimate: SynthesisEstimate;
  readonly previousPhrase: string | null;
  readonly hasAudio: boolean;
};

export const INITIAL_RENDER: RenderState = {
  estimate: INITIAL_SYNTHESIS_ESTIMATE,
  previousPhrase: null,
  hasAudio: false,
};

type RenderedPhrase = {
  readonly handle: ClipHandle;
  readonly synthMs: number;
};

class NaturalPhraseFailed extends Data.TaggedError('NaturalPhraseFailed')<{
  readonly reason: FallbackReason;
  readonly guardMs: number;
  readonly elapsedMs: number;
}> {}

function isBusyReason(reason: FallbackReason): boolean {
  return reason === 'engine_busy';
}

function isBusyFailure(error: NaturalVoiceFailure): boolean {
  return error._tag === 'IpcError' && error.code === 'busy';
}

function failureReason(
  error: NaturalVoiceFailure | Cause.TimeoutError,
  isBusy: boolean,
): FallbackReason {
  if (!Cause.isTimeoutError(error)) return 'synthesis_failed';
  return isBusy ? 'engine_busy' : 'guard_timeout';
}

function synthesizeWithinGuard(
  pipeline: Pipeline,
  output: NaturalOutput,
  phrase: string,
  guardMs: number,
) {
  return Effect.gen(function* () {
    const sawBusy = yield* Ref.make(false);
    const startedAt = yield* Clock.currentTimeMillis;
    return yield* pipeline.natural.synthesize(phrase, output.voiceId, pipeline.request.rate).pipe(
      Effect.tapError((error) => Ref.set(sawBusy, isBusyFailure(error))),
      Effect.retry({ while: isBusyFailure, schedule: Schedule.spaced(BUSY_RETRY_MS) }),
      Effect.timeout(guardMs),
      Effect.catch((error) =>
        Effect.gen(function* () {
          const isBusy = yield* Ref.get(sawBusy);
          const elapsedMs = (yield* Clock.currentTimeMillis) - startedAt;
          return yield* new NaturalPhraseFailed({
            reason: failureReason(error, isBusy),
            guardMs,
            elapsedMs,
          });
        }),
      ),
    );
  });
}

function renderPhrase(
  pipeline: Pipeline,
  output: NaturalOutput,
  phrase: string,
  guardMs: number,
  pauseMs: number,
): Effect.Effect<RenderedPhrase, NaturalPhraseFailed> {
  return Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    const wave = yield* synthesizeWithinGuard(pipeline, output, phrase, guardMs);
    const synthMs = (yield* Clock.currentTimeMillis) - startedAt;
    const handle = yield* output.session
      .enqueue(wave, pauseMs)
      .pipe(
        Effect.mapError(
          () => new NaturalPhraseFailed({ reason: 'enqueue_failed', guardMs, elapsedMs: synthMs }),
        ),
      );
    return { handle, synthMs };
  });
}

function fallBackToSystem(pipeline: Pipeline, isBusy: boolean): Effect.Effect<void> {
  return Ref.set(pipeline.isNaturalActive, false).pipe(
    Effect.andThen(
      Effect.sync(() => {
        if (!isBusy) pipeline.request.callbacks.onNaturalFailure();
      }),
    ),
  );
}

function cutNextPhrase(pipeline: Pipeline, budget: Parameters<typeof cutPhrase>[1]) {
  return Ref.modify(pipeline.text, (current): [string | undefined, TextState] => {
    const cut = cutPhrase(current.sentences, budget);
    return cut ? [cut.phrase, { ...current, sentences: cut.rest }] : [undefined, current];
  });
}

function afterFailure(
  pipeline: Pipeline,
  state: RenderState,
  phrase: string,
  failure: NaturalPhraseFailed,
): Effect.Effect<RenderState> {
  return fallBackToSystem(pipeline, isBusyReason(failure.reason)).pipe(
    Effect.andThen(
      pipeline.diagnostics({
        kind: 'natural_voice_fallback',
        reason: failure.reason,
        phrase_chars: phrase.length,
        guard_ms: failure.guardMs,
        elapsed_ms: failure.elapsedMs,
        is_first_phrase: !state.hasAudio,
      }),
    ),
    Effect.andThen(Queue.offer(pipeline.plays, { _tag: 'Utterance', text: phrase })),
    Effect.as({ ...state, previousPhrase: phrase }),
  );
}

function afterSuccess(
  pipeline: Pipeline,
  state: RenderState,
  phrase: string,
  rendered: RenderedPhrase,
): Effect.Effect<RenderState> {
  return Queue.offer(pipeline.plays, { _tag: 'Clip', handle: rendered.handle }).pipe(
    Effect.as({
      estimate: observeSynthesis(state.estimate, phrase.length, rendered.synthMs),
      previousPhrase: phrase,
      hasAudio: true,
    }),
  );
}

function renderNatural(
  pipeline: Pipeline,
  output: NaturalOutput,
  state: RenderState,
): Effect.Effect<RenderState> {
  return Effect.gen(function* () {
    const lead = yield* output.session.leadMs;
    const delay = renderDelayMs(lead);
    if (delay > 0) {
      yield* Effect.sleep(delay);
      return state;
    }
    const budget = state.hasAudio ? laterPhraseBudget(lead, state.estimate) : FIRST_PHRASE_BUDGET;
    const phrase = yield* cutNextPhrase(pipeline, budget);
    if (phrase === undefined) return state;
    const guard = synthesisGuardMs(state.hasAudio ? lead : null);
    return yield* renderPhrase(
      pipeline,
      output,
      phrase,
      guard,
      pauseBeforeMs(state.previousPhrase),
    ).pipe(
      Effect.matchEffect({
        onFailure: (failure) => afterFailure(pipeline, state, phrase, failure),
        onSuccess: (rendered) => afterSuccess(pipeline, state, phrase, rendered),
      }),
    );
  });
}

function handOverSentence(pipeline: Pipeline, state: RenderState): Effect.Effect<RenderState> {
  return takeSentence(pipeline).pipe(
    Effect.flatMap((sentence) =>
      sentence === undefined
        ? Effect.void
        : Queue.offer(pipeline.plays, { _tag: 'Utterance', text: sentence }),
    ),
    Effect.as(state),
  );
}

function renderStep(pipeline: Pipeline, state: RenderState): Effect.Effect<RenderState> {
  return Effect.gen(function* () {
    const isNatural = yield* Ref.get(pipeline.isNaturalActive);
    if (isNatural && pipeline.naturalOutput !== null) {
      return yield* renderNatural(pipeline, pipeline.naturalOutput, state);
    }
    return yield* handOverSentence(pipeline, state);
  });
}

export function renderLoop(pipeline: Pipeline, state: RenderState): Effect.Effect<void> {
  return Effect.gen(function* () {
    const current = yield* Ref.get(pipeline.text);
    if (current.sentences.length > 0) {
      yield* markStarted(pipeline);
      return yield* renderLoop(pipeline, yield* renderStep(pipeline, state));
    }
    if (current.isFinished) {
      yield* Queue.end(pipeline.plays);
      return;
    }
    yield* Queue.take(pipeline.wake);
    return yield* renderLoop(pipeline, state);
  });
}
