import { describe, expect, test } from 'bun:test';
import { finalOnly, NATURAL, runToEnd, THREE_SENTENCES } from './harness';

describe('fallback to the system voice', () => {
  test('a first phrase slower than the interactive guard is spoken by the system voice', async () => {
    const run = await runToEnd(NATURAL, finalOnly(THREE_SENTENCES), { latencyMs: () => 1200 });

    expect(run.clips).toEqual([]);
    expect(run.spoken.map((utterance) => utterance.text).join(' ')).toBe(THREE_SENTENCES);
    expect(run.events).toEqual(['natural-failure', 'first-audio', 'end']);
    expect(run.diagnosticEvents).toEqual([
      {
        kind: 'natural_voice_fallback',
        reason: 'guard_timeout',
        phrase_chars: expect.any(Number),
        guard_ms: 800,
        elapsed_ms: 800,
        is_first_phrase: true,
      },
    ]);
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
    expect(run.diagnosticEvents).toMatchObject([
      { reason: 'synthesis_failed', is_first_phrase: false },
    ]);
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
    expect(run.diagnosticEvents.map((event) => event.reason)).toEqual(['engine_busy']);
  });

  test('an audio output that cannot open means system speech from the start', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), { openFails: true });

    expect(run.requests).toEqual([]);
    expect(run.events).toEqual(['natural-failure', 'first-audio', 'end']);
    expect(run.diagnosticEvents).toEqual([
      {
        kind: 'natural_voice_fallback',
        reason: 'output_failed_to_open',
        phrase_chars: 0,
        guard_ms: 0,
        elapsed_ms: null,
        is_first_phrase: true,
      },
    ]);
  });

  test('audio that cannot be decoded is replaced by the system voice', async () => {
    const run = await runToEnd(NATURAL, finalOnly('That sounds useful.'), { decodeFails: true });

    expect(run.spoken.map((utterance) => utterance.text)).toEqual(['That sounds useful.']);
    expect(run.events).toEqual(['natural-failure', 'first-audio', 'end']);
    expect(run.diagnosticEvents.map((event) => event.reason)).toEqual(['enqueue_failed']);
  });
});
