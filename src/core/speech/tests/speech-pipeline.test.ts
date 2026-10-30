import { describe, expect, test } from 'bun:test';
import { Effect, Fiber, Schedule, Stream } from 'effect';
import { Speech } from '../services/speech-service';
import type { ReplyEvent } from '../types';
import { audioMsOf } from './fakes';
import { advance, finalOnly, NATURAL, runToEnd, SYSTEM, scene, THREE_SENTENCES } from './harness';

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
