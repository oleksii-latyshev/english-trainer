import { describe, expect, it } from 'bun:test';
import { Duration, Effect, Fiber, Layer, Option, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import { IpcError } from '@/core/ipc';
import { LIVE_INTERVAL, liveTranscript } from '../services/live-transcript';
import { rescueTranscript } from '../services/rescue-transcript';
import { SpeechRecognition } from '../services/speech-recognition-service';
import { type FakeRust, fakeRecognitionRust, wavOf } from './recognition-fakes';

function scene(rust: FakeRust = {}) {
  const fake = fakeRecognitionRust(rust);
  const layer = SpeechRecognition.layer.pipe(
    Layer.provideMerge(fake.layer),
    Layer.provideMerge(TestClock.layer()),
  );
  return { ...fake, layer };
}

describe('transcribing an answer', () => {
  it('sends the recording to Rust and returns the words with the time it took', async () => {
    const { layer, binaryCalls } = scene({
      binaryResults: {
        transcribe_audio: { text: 'I went home', language: 'en', duration_ms: 900 },
      },
    });
    const answer = await Effect.runPromise(
      Effect.gen(function* () {
        const recognition = yield* SpeechRecognition;
        return yield* recognition.transcribe(wavOf('audio'));
      }).pipe(Effect.provide(layer)),
    );
    expect(answer.text).toBe('I went home');
    expect(answer.sttMs).toBeGreaterThanOrEqual(0);
    expect(binaryCalls.map((call) => call.command)).toEqual(['transcribe_audio']);
    expect(new TextDecoder().decode(binaryCalls[0]?.bytes)).toBe('audio');
  });

  it('fails with what Rust said', async () => {
    const failure = new IpcError({ code: 'no_speech', message: 'Speak again.' });
    const { layer } = scene({ failBinaryWith: failure });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const recognition = yield* SpeechRecognition;
        return yield* recognition.transcribe(wavOf('audio')).pipe(Effect.flip);
      }).pipe(Effect.provide(layer)),
    );
    expect(result).toBe(failure);
  });
});

describe('asking for help while speaking', () => {
  const turn = { sessionId: 7, sequence: 3 };

  it('names the answer in the headers and keeps the last words', async () => {
    const { layer, binaryCalls } = scene({
      binaryResults: { transcribe_rescue: `${'x'.repeat(2000)}end` },
    });
    const text = await Effect.runPromise(
      rescueTranscript(Effect.succeed(wavOf('audio')), turn).pipe(Effect.provide(layer)),
    );
    expect(text.length).toBe(1500);
    expect(text.endsWith('end')).toBe(true);
    expect(binaryCalls[0]?.headers).toEqual({ 'x-session-id': '7', 'x-answer-sequence': '3' });
  });

  it('says so when nothing has been recorded yet', async () => {
    const { layer, binaryCalls } = scene();
    const failure = await Effect.runPromise(
      rescueTranscript(Effect.succeed(null), turn).pipe(Effect.flip, Effect.provide(layer)),
    );
    expect(failure).toMatchObject({ code: 'no_speech' });
    expect(binaryCalls).toEqual([]);
  });

  it('says so when Rust heard only silence', async () => {
    const { layer } = scene({ binaryResults: { transcribe_rescue: '   ' } });
    const failure = await Effect.runPromise(
      rescueTranscript(Effect.succeed(wavOf('audio')), turn).pipe(
        Effect.flip,
        Effect.provide(layer),
      ),
    );
    expect(failure).toMatchObject({ code: 'no_speech' });
  });
});

describe('the live transcript', () => {
  function collect(rust: FakeRust, options: { heard: () => boolean; seconds: number }) {
    const { layer, binaryCalls } = scene(rust);
    const texts: string[] = [];
    const program = Effect.gen(function* () {
      const fiber = yield* liveTranscript({
        snapshot: Effect.succeed(wavOf('audio')),
        hasHeardSpeech: Effect.sync(options.heard),
      }).pipe(
        Stream.runForEach((text) => Effect.sync(() => texts.push(text))),
        Effect.forkChild,
      );
      for (let step = 0; step < options.seconds * 10; step += 1) {
        yield* TestClock.adjust(Duration.millis(100));
      }
      yield* Fiber.interrupt(fiber);
    });
    return Effect.runPromise(program.pipe(Effect.provide(layer))).then(() => ({
      texts,
      binaryCalls,
    }));
  }

  it('shows the words heard so far every interval once speech started', async () => {
    const { texts, binaryCalls } = await collect(
      { binaryResults: { transcribe_partial: 'I think' } },
      { heard: () => true, seconds: 5 },
    );
    expect(texts.length).toBe(Math.floor(5000 / Duration.toMillis(LIVE_INTERVAL)));
    expect(texts.every((text) => text === 'I think')).toBe(true);
    expect(binaryCalls.every((call) => call.command === 'transcribe_partial')).toBe(true);
  });

  it('does nothing until speech has been heard', async () => {
    const { texts, binaryCalls } = await collect(
      { binaryResults: { transcribe_partial: 'I think' } },
      { heard: () => false, seconds: 5 },
    );
    expect(texts).toEqual([]);
    expect(binaryCalls).toEqual([]);
  });

  it('does nothing when the model is not loaded', async () => {
    const { texts, binaryCalls } = await collect(
      {
        status: { server: 'loading', failure: null, is_live_transcript_available: true },
        binaryResults: { transcribe_partial: 'I think' },
      },
      { heard: () => true, seconds: 5 },
    );
    expect(texts).toEqual([]);
    expect(binaryCalls).toEqual([]);
  });

  it('does nothing when the live transcript is off', async () => {
    const { texts } = await collect(
      {
        status: { server: 'ready', failure: null, is_live_transcript_available: false },
        binaryResults: { transcribe_partial: 'I think' },
      },
      { heard: () => true, seconds: 5 },
    );
    expect(texts).toEqual([]);
  });

  it('skips a missed update instead of failing', async () => {
    const { texts } = await collect(
      { failBinaryWith: new IpcError({ code: 'busy', message: 'Busy.' }) },
      { heard: () => true, seconds: 5 },
    );
    expect(texts).toEqual([]);
  });

  it('skips the ticks that find the previous update still running', async () => {
    const { binaryCalls } = await collect(
      { binaryResults: { transcribe_partial: 'I think' }, binaryDelay: Duration.seconds(4) },
      { heard: () => true, seconds: 9 },
    );
    expect(binaryCalls.length).toBe(2);
  });

  it('shows nothing for a null answer', async () => {
    const { texts } = await collect(
      { binaryResults: { transcribe_partial: null } },
      { heard: () => true, seconds: 5 },
    );
    expect(Option.fromNullishOr(texts[0]).pipe(Option.isNone)).toBe(true);
  });
});
