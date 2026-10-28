import { describe, expect, it } from 'bun:test';
import { Effect, Ref, Stream } from 'effect';
import type { TurnEvent } from '../audio';
import { meterLevels, speechOnsets, turnEvents } from '../services/turn-stream';
import { frameOf } from './fakes';

const FRAME_MS = 20;

type Step = { readonly rms: number; readonly forMs: number; readonly hold?: boolean };

function stepsToFrames(steps: readonly Step[]) {
  return steps.flatMap((step) =>
    Array.from({ length: step.forMs / FRAME_MS }, (_, index) => ({
      frame: frameOf(step.rms, FRAME_MS),
      hold: index === 0 ? step.hold : undefined,
    })),
  );
}

function sourceOf(steps: readonly Step[], hold: Ref.Ref<boolean>) {
  return {
    noiseFloor: Effect.succeed(0.002),
    frames: Stream.fromIterable(stepsToFrames(steps)).pipe(
      Stream.tap(({ hold: next }) => (next === undefined ? Effect.void : Ref.set(hold, next))),
      Stream.map(({ frame }) => frame),
    ),
  };
}

function eventsOf(
  steps: readonly Step[],
  options: { endPauseMs: number; settleMs?: number; extraPauseMs?: number },
): Promise<string[]> {
  return Effect.gen(function* () {
    const hold = yield* Ref.make(false);
    const extraPauseMs = yield* Ref.make(options.extraPauseMs ?? 0);
    const events = yield* turnEvents(sourceOf(steps, hold), {
      ...options,
      hold,
      extraPauseMs,
    }).pipe(Stream.runCollect);
    return events.map((event: TurnEvent) => event._tag);
  }).pipe(Effect.runPromise);
}

describe('turn events', () => {
  it('reports speech then the end of the turn', async () => {
    const events = await eventsOf(
      [
        { rms: 0.08, forMs: 600 },
        { rms: 0.002, forMs: 1200 },
      ],
      { endPauseMs: 1000 },
    );
    expect(events).toEqual(['SpeechStarted', 'TurnEnded']);
  });

  it('waits longer after an unfinished clause', async () => {
    const steps = [
      { rms: 0.08, forMs: 600 },
      { rms: 0.002, forMs: 1600 },
    ];
    expect(await eventsOf(steps, { endPauseMs: 1000, extraPauseMs: 1200 })).toEqual([
      'SpeechStarted',
    ]);
    expect(await eventsOf(steps, { endPauseMs: 1000 })).toEqual(['SpeechStarted', 'TurnEnded']);
  });

  it('ignores the settle span so the assistant voice tail is not heard as speech', async () => {
    const events = await eventsOf([{ rms: 0.08, forMs: 400 }], { endPauseMs: 1000, settleMs: 400 });
    expect(events).toEqual([]);
    const later = await eventsOf([{ rms: 0.08, forMs: 800 }], { endPauseMs: 1000, settleMs: 400 });
    expect(later).toEqual(['SpeechStarted']);
  });

  it('holds the turn open until released', async () => {
    const held = await eventsOf(
      [
        { rms: 0.08, forMs: 600 },
        { rms: 0.002, forMs: 4000, hold: true },
      ],
      { endPauseMs: 1000 },
    );
    expect(held).toEqual(['SpeechStarted']);
    const released = await eventsOf(
      [
        { rms: 0.08, forMs: 600 },
        { rms: 0.002, forMs: 4000, hold: true },
        { rms: 0.002, forMs: 1200, hold: false },
      ],
      { endPauseMs: 1000 },
    );
    expect(released).toEqual(['SpeechStarted', 'TurnEnded']);
  });

  it('ends a turn only once', async () => {
    const events = await eventsOf(
      [
        { rms: 0.08, forMs: 600 },
        { rms: 0.002, forMs: 3000 },
        { rms: 0.08, forMs: 600 },
      ],
      { endPauseMs: 1000 },
    );
    expect(events).toEqual(['SpeechStarted', 'TurnEnded']);
  });
});

describe('speech onsets', () => {
  async function onsetsOf(steps: readonly Step[], isEnabled: boolean) {
    const hold = Ref.makeUnsafe(false);
    const onsets = await speechOnsets(sourceOf(steps, hold), {
      isEnabled: Effect.succeed(isEnabled),
    }).pipe(Stream.runCollect, Effect.runPromise);
    return onsets.length;
  }

  it('signals once after sustained speech when enabled', async () => {
    expect(await onsetsOf([{ rms: 0.08, forMs: 1000 }], true)).toBe(1);
  });

  it('stays silent when interruption is not enabled', async () => {
    expect(await onsetsOf([{ rms: 0.08, forMs: 1000 }], false)).toBe(0);
  });

  it('ignores a burst shorter than 300 ms', async () => {
    expect(await onsetsOf([{ rms: 0.08, forMs: 200 }], true)).toBe(0);
  });
});

describe('meter levels', () => {
  it('maps frame energy to the 0..1 meter', async () => {
    const hold = Ref.makeUnsafe(false);
    const levels = await meterLevels(
      sourceOf(
        [
          { rms: 0, forMs: 20 },
          { rms: 1, forMs: 20 },
        ],
        hold,
      ),
    ).pipe(Stream.runCollect, Effect.runPromise);
    expect(levels).toEqual([0, 1]);
  });
});
