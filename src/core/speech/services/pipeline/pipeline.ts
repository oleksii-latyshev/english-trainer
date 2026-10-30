import { type Cause, Clock, Effect, Option, Queue, Ref, type Scope } from 'effect';
import type { DiagnosticEvent } from '@/core/diagnostics';
import type { NaturalVoiceId } from '@/core/voice-preference';
import { createSpeechStreamState, type SpeechStreamState } from '../../helpers/reply-sentences';
import type { SpeakRequest } from '../../types';
import type { AudioOutputShape, AudioSession, ClipHandle } from '../audio-output-service';
import type { NaturalVoiceShape } from '../natural-voice-service';
import type { SystemVoiceShape } from '../system-voice-service';

export type SpeechDependencies = {
  readonly diagnostics: (event: DiagnosticEvent) => Effect.Effect<void>;
  readonly natural: NaturalVoiceShape;
  readonly output: AudioOutputShape;
  readonly system: SystemVoiceShape;
};

export type TextState = {
  readonly stream: SpeechStreamState;
  readonly sentences: readonly string[];
  readonly isFinished: boolean;
};

export type PlayItem =
  | { readonly _tag: 'Clip'; readonly handle: ClipHandle }
  | { readonly _tag: 'Utterance'; readonly text: string };

export type NaturalOutput = {
  readonly session: AudioSession;
  readonly voiceId: NaturalVoiceId;
};

export type Pipeline = {
  readonly diagnostics: (event: DiagnosticEvent) => Effect.Effect<void>;
  readonly natural: NaturalVoiceShape;
  readonly system: SystemVoiceShape;
  readonly request: SpeakRequest;
  readonly naturalOutput: NaturalOutput | null;
  readonly text: Ref.Ref<TextState>;
  readonly wake: Queue.Queue<void>;
  readonly plays: Queue.Queue<PlayItem, Cause.Done>;
  readonly startedAt: Ref.Ref<number | null>;
  readonly hasPlayed: Ref.Ref<boolean>;
  readonly isNaturalActive: Ref.Ref<boolean>;
};

const INITIAL_TEXT: TextState = {
  stream: createSpeechStreamState(),
  sentences: [],
  isFinished: false,
};

function openNaturalOutput(
  output: AudioOutputShape,
  request: SpeakRequest,
): Effect.Effect<NaturalOutput | null, never, Scope.Scope> {
  const { engine } = request;
  if (engine.kind !== 'natural') return Effect.succeed(null);
  return output.open.pipe(
    Effect.map((session): NaturalOutput | null => ({ session, voiceId: engine.voiceId })),
    Effect.orElseSucceed(() => null),
  );
}

export function makePipeline(
  dependencies: SpeechDependencies,
  request: SpeakRequest,
): Effect.Effect<Pipeline, never, Scope.Scope> {
  return Effect.gen(function* () {
    const naturalOutput = yield* openNaturalOutput(dependencies.output, request);
    if (request.engine.kind === 'natural' && naturalOutput === null) {
      yield* Effect.sync(() => request.callbacks.onNaturalFailure());
      yield* dependencies.diagnostics({
        kind: 'natural_voice_fallback',
        reason: 'output_failed_to_open',
        phrase_chars: 0,
        guard_ms: 0,
        elapsed_ms: null,
        is_first_phrase: true,
      });
    }
    return {
      diagnostics: dependencies.diagnostics,
      natural: dependencies.natural,
      system: dependencies.system,
      request,
      naturalOutput,
      text: yield* Ref.make(INITIAL_TEXT),
      wake: yield* Queue.sliding<void>(1),
      plays: yield* Queue.unbounded<PlayItem, Cause.Done>(),
      startedAt: yield* Ref.make<number | null>(null),
      hasPlayed: yield* Ref.make(false),
      isNaturalActive: yield* Ref.make(naturalOutput !== null),
    };
  });
}

export function markStarted(pipeline: Pipeline): Effect.Effect<void> {
  return Effect.gen(function* () {
    if ((yield* Ref.get(pipeline.startedAt)) !== null) return;
    yield* Ref.set(pipeline.startedAt, yield* Clock.currentTimeMillis);
    yield* Effect.sync(() => pipeline.request.callbacks.onState({ tag: 'starting' }));
  });
}

export function announceFirstAudio(pipeline: Pipeline): Effect.Effect<void> {
  return Effect.gen(function* () {
    if (yield* Ref.getAndSet(pipeline.hasPlayed, true)) return;
    const begun = Option.fromNullishOr(yield* Ref.get(pipeline.startedAt));
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.sync(() => {
      pipeline.request.callbacks.onState({ tag: 'speaking' });
      pipeline.request.callbacks.onFirstAudio(now - Option.getOrElse(begun, () => now));
    });
  });
}
