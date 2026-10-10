// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, test } from 'bun:test';
import { appendSpeechDelta, createSpeechStreamState, finishSpeechStream } from './speechStream';

describe('system speech streaming', () => {
  test('releases a complete sentence while the provider stream remains open', () => {
    const result = appendSpeechDelta(createSpeechStreamState(), 'That sounds useful.');

    expect(result.utterances).toEqual(['That sounds useful.']);
    expect(result.state.isFinished).toBe(false);
  });

  test('keeps words and split punctuation in the buffer across delta boundaries', () => {
    const first = appendSpeechDelta(createSpeechStreamState(), 'We should con');
    expect(first.utterances).toEqual([]);

    const second = appendSpeechDelta(first.state, 'tinue. What do you think');
    expect(second.utterances).toEqual(['We should continue.']);
    expect(second.state.pendingText).toBe('What do you think');

    const third = appendSpeechDelta(second.state, '?');
    expect(third.utterances).toEqual(['What do you think?']);
  });

  test('does not split decimal numbers or common abbreviations', () => {
    const result = appendSpeechDelta(
      createSpeechStreamState(),
      'Dr. Lee paid 3.14 dollars. For example, this works.',
    );

    expect(result.utterances).toEqual(['Dr. Lee paid 3.14 dollars.', 'For example, this works.']);
  });

  test('waits when a decimal point lands at the end of a delta', () => {
    const first = appendSpeechDelta(createSpeechStreamState(), 'It costs 3.');
    expect(first.utterances).toEqual([]);

    const second = appendSpeechDelta(first.state, '14 dollars.');
    expect(second.utterances).toEqual(['It costs 3.14 dollars.']);
  });

  test('buffers a period after a single letter until a chunked abbreviation is clear', () => {
    const first = appendSpeechDelta(createSpeechStreamState(), 'e.');
    expect(first.utterances).toEqual([]);

    const second = appendSpeechDelta(first.state, 'g.');
    expect(second.utterances).toEqual([]);

    const third = appendSpeechDelta(second.state, ' This is useful.');
    expect(third.utterances).toEqual(['e.g. This is useful.']);
  });

  test('keeps closing quotation marks with their sentence', () => {
    const result = appendSpeechDelta(createSpeechStreamState(), '"Great!" Next sentence.');

    expect(result.utterances).toEqual(['"Great!"', 'Next sentence.']);
  });

  test('strips markdown syntax while preserving spoken words', () => {
    const result = appendSpeechDelta(createSpeechStreamState(), '**Hello**, *there*!');

    expect(result.utterances).toEqual(['Hello, there!']);
  });

  test('speaks non-streamed final text once and ignores later deltas', () => {
    const result = finishSpeechStream(createSpeechStreamState(), 'A complete answer.');
    const afterFinish = appendSpeechDelta(result.state, 'Another sentence.');

    expect(result.utterances).toEqual(['A complete answer.']);
    expect(afterFinish.utterances).toEqual([]);
  });

  test('reconciles the canonical ending without replaying the queued prefix or final question', () => {
    const first = appendSpeechDelta(createSpeechStreamState(), 'Hello there.');
    const second = appendSpeechDelta(first.state, 'How are');
    const result = finishSpeechStream(second.state, 'Hello there. How are you?');

    expect(first.utterances).toEqual(['Hello there.']);
    expect(result.utterances).toEqual(['How are you?']);
  });

  test('discards canonical text when it diverges from the already queued prefix', () => {
    const first = appendSpeechDelta(createSpeechStreamState(), 'Hello there.');
    const result = finishSpeechStream(first.state, 'Hello friend and goodbye.');

    expect(result.utterances).toEqual([]);
  });

  test('does not replay a queued prefix when the entire canonical reply differs', () => {
    const first = appendSpeechDelta(createSpeechStreamState(), 'We started here.');
    const result = finishSpeechStream(first.state, 'A replacement reply.');

    expect(result.utterances).toEqual([]);
  });
});
