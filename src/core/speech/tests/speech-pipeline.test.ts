import { describe, expect, test } from 'bun:test';
import { Effect, Fiber, Layer, Schedule, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import { Speech } from '../services/speech-service';
import type { ReplyEvent, SpeechEngineChoice } from '../types';
import { audioMsOf, fakeSpeechEdges, type NaturalBehaviour, recordingCallbacks } from './fakes';

const NATURAL: SpeechEngineChoice = { kind: 'natural', voiceId: 0, fallbackVoiceURI: null };
const SYSTEM: SpeechEngineChoice = { kind: 'system', voiceURI: null };

const THREE_SENTENCES =
  'I understand, learning a new language can feel slow sometimes. But you are making real progress, and your sentences are getting longer. Which topic would you like to practise next?';

function finalOnly(text: string): Stream.Stream<ReplyEvent> {
  return Stream.make({ _tag: 'Final', text });
}

function advance(totalMs: number, stepMs = 10) {
  return Effect.forEach(Array.from({ length: totalMs / stepMs }), () => TestClock.adjust(stepMs), {
    discard: true,
  });
}

function scene(behaviour: NaturalBehaviour = {}) {
  const edges = fakeSpeechEdges(behaviour);
  const recorded = recordingCallbacks();
  const layer = Speech.layer.pipe(
    Layer.provideMerge(edges.layer),
    Layer.provideMerge(TestClock.layer()),
  );
  return { edges, recorded, layer };
}

async function runToEnd(
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

describe('natural speech pipeline', () => {
  test('first audio starts once the first short phrase is rendered', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES));

    const firstPhrase = run.requests[0]?.text ?? '';
    expect(firstPhrase.length).toBeLessThanOrEqual(40);
    expect(run.firstAudioLatencies).toHaveLength(1);
    expect(run.firstAudioLatencies[0]).toBeGreaterThanOrEqual(250 + 11 * firstPhrase.length);
    expect(run.firstAudioLatencies[0]).toBeLessThan(250 + 11 * firstPhrase.length + 100);
  });

  test('renders the next phrase while the current one plays, so phrases of one sentence touch', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES));

    const insideSentence = run.clips.filter((clip) => clip.pauseBeforeMs === 0).slice(1);
    expect(insideSentence.length).toBeGreaterThan(0);
    for (const clip of insideSentence) {
      const previous = run.clips[run.clips.indexOf(clip) - 1];
      expect(clip.startsAtMs - (previous?.endsAtMs ?? 0)).toBe(0);
    }
  });

  test('puts a short pause between sentences', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES));

    const pauses = run.clips.map((clip) => clip.pauseBeforeMs).filter((pause) => pause > 0);
    expect(pauses).toEqual([150, 150]);
  });

  test('speaks every word of the reply exactly once', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES));

    expect(run.requests.map((request) => request.text).join(' ')).toBe(THREE_SENTENCES);
  });

  test('reports the end only after the last audio has finished', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES));

    const lastEnd = run.clips[run.clips.length - 1]?.endsAtMs ?? 0;
    const total = run.requests.reduce((sum, request) => sum + audioMsOf(request.text), 0);
    expect(run.events).toEqual(['first-audio', 'end']);
    expect(lastEnd).toBeGreaterThanOrEqual(total);
    expect(run.states[run.states.length - 1]).toEqual({ tag: 'idle' });
  });

  test('streams sentences as they arrive instead of waiting for the whole reply', async () => {
    const { edges, recorded, layer } = scene();
    const replies = Stream.make<ReplyEvent[]>(
      { _tag: 'Delta', text: 'That sounds useful. ' },
      { _tag: 'Delta', text: 'What would you try first?' },
      { _tag: 'Final', text: 'That sounds useful. What would you try first?' },
    ).pipe(Stream.schedule(Schedule.spaced(2000)));
    const program = Effect.gen(function* () {
      const speech = yield* Speech;
      const fiber = yield* Effect.forkChild(
        speech.speak({ engine: NATURAL, rate: 1, replies, callbacks: recorded.callbacks }),
      );
      yield* advance(2500);
      const firstRequested = edges.requests.map((request) => request.text);
      yield* advance(20_000);
      yield* Fiber.join(fiber);
      return firstRequested;
    });

    const earlyRequests = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(earlyRequests).toEqual(['That sounds useful.']);
  });
});

describe('fallback to the system voice', () => {
  test('a first phrase slower than the interactive guard is spoken by the system voice', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES), { latencyMs: () => 1200 });

    expect(run.clips).toEqual([]);
    expect(run.spoken.map((utterance) => utterance.text).join(' ')).toBe(THREE_SENTENCES);
    expect(run.events).toEqual(['natural-failure', 'first-audio', 'end']);
  });

  test('later phrases may take longer than the first guard because audio is already queued', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES), {
      latencyMs: (_text, index) => (index === 0 ? 400 : 1500),
    });

    expect(run.spoken).toEqual([]);
    expect(run.events).toEqual(['first-audio', 'end']);
  });

  test('a failure in the middle hands the rest to the system voice after the queued audio ends', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES), {
      failure: (index) => (index === 1 ? 'unavailable' : undefined),
    });

    const lastClipEnd = run.clips[run.clips.length - 1]?.endsAtMs ?? 0;
    expect(run.clips).toHaveLength(1);
    expect(run.spoken[0]?.atMs).toBeGreaterThanOrEqual(lastClipEnd);
    const spokenText = [...run.requests.slice(0, 1), ...run.spoken].map((entry) => entry.text);
    expect(spokenText.join(' ')).toBe(THREE_SENTENCES);
    expect(run.events).toEqual(['first-audio', 'natural-failure', 'end']);
  });

  test('a busy engine is retried inside the guard without leaving natural speech', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), {
      failure: (index) => (index < 2 ? 'busy' : undefined),
      latencyMs: () => 20,
    });

    expect(run.requests.map((request) => request.text)).toEqual(
      Array(3).fill('That sounds useful.'),
    );
    expect(run.clips).toHaveLength(1);
    expect(run.events).toEqual(['first-audio', 'end']);
  });

  test('an engine that stays busy falls back without asking for a re-warm', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), {
      failure: () => 'busy',
      latencyMs: () => 20,
    });

    expect(run.spoken.map((utterance) => utterance.text)).toEqual(['That sounds useful.']);
    expect(run.events).toEqual(['first-audio', 'end']);
  });

  test('an audio output that cannot open means system speech from the start', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), { openFails: true });

    expect(run.requests).toEqual([]);
    expect(run.events).toEqual(['natural-failure', 'first-audio', 'end']);
  });

  test('audio that cannot be decoded is replaced by the system voice', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), { decodeFails: true });

    expect(run.spoken.map((utterance) => utterance.text)).toEqual(['That sounds useful.']);
    expect(run.events).toEqual(['natural-failure', 'first-audio', 'end']);
  });
});

describe('audio that does not start', () => {
  test('is reported as a playback failure instead of hanging the conversation', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), { neverStarts: true });

    expect(run.events).toEqual(['error']);
    expect(run.states[run.states.length - 1]).toEqual({ tag: 'error', reason: 'playback-failed' });
  });
});

describe('system engine', () => {
  test('speaks sentences as they complete without touching the natural voice', async () => {
    const replies = Stream.make<ReplyEvent[]>(
      { _tag: 'Delta', text: 'That sounds useful. ' },
      { _tag: 'Delta', text: 'What would you try first?' },
      { _tag: 'Final', text: 'That sounds useful. What would you try first?' },
    );

    const run = await runToEnd(SYSTEM, replies);

    expect(run.requests).toEqual([]);
    expect(run.spoken.map((utterance) => utterance.text)).toEqual([
      'That sounds useful.',
      'What would you try first?',
    ]);
    expect(run.events).toEqual(['first-audio', 'end']);
  });

  test('a reply that arrives whole is spoken once', async () => {
    const run = await runToEnd(SYSTEM, finalOnly(THREE_SENTENCES));

    expect(run.spoken.map((utterance) => utterance.text)).toEqual([THREE_SENTENCES]);
  });
});

describe('edge cases', () => {
  test('an empty reply is reported as empty text', async () => {
    const run = await runToEnd(NATURAL, finalOnly('   '));

    expect(run.events).toEqual(['error']);
    expect(run.states[run.states.length - 1]).toEqual({ tag: 'error', reason: 'empty-text' });
  });

  test('interrupting drops audio that finishes rendering later', async () => {
    const { edges, recorded, layer } = scene({ latencyMs: () => 700 });
    const program = Effect.gen(function* () {
      const speech = yield* Speech;
      const fiber = yield* Effect.forkChild(
        speech.speak({
          engine: NATURAL,
          rate: 1,
          replies: finalOnly(THREE_SENTENCES),
          callbacks: recorded.callbacks,
        }),
      );
      yield* advance(300);
      yield* Fiber.interrupt(fiber);
      yield* advance(5000);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(edges.clips).toEqual([]);
    expect(recorded.events).toEqual([]);
    expect(edges.closedSessions).toHaveLength(1);
  });

  test('interrupting during playback stops asking for more audio', async () => {
    const { edges, recorded, layer } = scene();
    const program = Effect.gen(function* () {
      const speech = yield* Speech;
      const fiber = yield* Effect.forkChild(
        speech.speak({
          engine: NATURAL,
          rate: 1,
          replies: finalOnly(THREE_SENTENCES),
          callbacks: recorded.callbacks,
        }),
      );
      yield* advance(1000);
      yield* Fiber.interrupt(fiber);
      yield* advance(20_000);
    });

    await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(recorded.events).toEqual(['first-audio']);
    expect(edges.closedSessions).toHaveLength(1);
  });
});
