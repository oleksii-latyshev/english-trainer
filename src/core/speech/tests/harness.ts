import { Effect, Fiber, Layer, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import { Speech } from '../services/speech-service';
import type { ReplyEvent, SpeechEngineChoice } from '../types';
import { fakeSpeechEdges, type NaturalBehaviour, recordingCallbacks } from './fakes';

export const NATURAL: SpeechEngineChoice = { kind: 'natural', voiceId: 0, fallbackVoiceURI: null };
export const SYSTEM: SpeechEngineChoice = { kind: 'system', voiceURI: null };

export const THREE_SENTENCES =
  'I understand, learning a new language can feel slow sometimes. But you are making real progress, and your sentences are getting longer. Which topic would you like to practise next?';

export function finalOnly(text: string): Stream.Stream<ReplyEvent> {
  return Stream.make({ _tag: 'Final', text });
}

export function advance(totalMs: number, stepMs = 10) {
  return Effect.forEach(Array.from({ length: totalMs / stepMs }), () => TestClock.adjust(stepMs), {
    discard: true,
  });
}

export function scene(behaviour: NaturalBehaviour = {}) {
  const edges = fakeSpeechEdges(behaviour);
  const recorded = recordingCallbacks();
  const layer = Speech.layer.pipe(
    Layer.provideMerge(edges.layer),
    Layer.provideMerge(TestClock.layer()),
  );
  return { edges, recorded, layer };
}

export async function runToEnd(
  engine: SpeechEngineChoice,
  replies: Stream.Stream<ReplyEvent>,
  behaviour: NaturalBehaviour = {},
  durationMs = 40_000,
) {
  const { edges, recorded, layer } = scene(behaviour);
  const program = Effect.gen(function* () {
    const speech = yield* Speech;
    const fiber = yield* Effect.forkChild(
      speech.speak({ engine, rate: 1, replies, callbacks: recorded.callbacks }),
    );
    yield* advance(durationMs);
    yield* Fiber.join(fiber);
  });
  await Effect.runPromise(program.pipe(Effect.provide(layer)));
  return { ...edges, ...recorded };
}
