import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Fiber, Layer, Stream, SubscriptionRef } from 'effect';
import type { ActualAudioInput } from '../audio';
import { type MicrophoneError, microphoneDisconnected, microphoneNotReady } from '../errors';
import { DevicePreference } from '../services/device-preference-service';
import {
  Microphone,
  type MicrophoneOpenOptions,
  type MicrophoneSession,
} from '../services/microphone-service';
import { WarmMicrophone } from '../services/warm-microphone-service';

type FakeOpen = {
  readonly options: MicrophoneOpenOptions;
  closed: boolean;
  readonly finishOpen: () => void;
  readonly failOpen: (error: MicrophoneError) => void;
  readonly warm: () => void;
  readonly lose: (error: MicrophoneError) => void;
};

const INPUT: ActualAudioInput = { deviceId: '', label: 'Fake' };

function fakeSession(
  warmed: Deferred.Deferred<void, MicrophoneError>,
  lost: Deferred.Deferred<never, MicrophoneError>,
): MicrophoneSession {
  return {
    input: INPUT,
    frames: Stream.empty,
    levels: Stream.empty,
    level: Effect.succeed(0),
    noiseFloor: Effect.succeed(0),
    isWarm: Effect.succeed(false),
    warmed: Deferred.await(warmed),
    lost: Deferred.await(lost),
    echoCancellationEnabled: Effect.succeed(false),
    capture: () => Effect.die('not used'),
    turns: () => Stream.empty,
    speechOnsets: () => Stream.empty,
  };
}

function fakeMicrophone(opens: FakeOpen[]) {
  return Layer.effect(
    Microphone,
    Effect.gen(function* () {
      const lastInput = yield* SubscriptionRef.make<ActualAudioInput | null>(null);
      return {
        lastInput,
        open: (options: MicrophoneOpenOptions = {}) =>
          Effect.gen(function* () {
            const gate = yield* Deferred.make<void, MicrophoneError>();
            const warmed = yield* Deferred.make<void, MicrophoneError>();
            const lost = yield* Deferred.make<never, MicrophoneError>();
            const record: FakeOpen = {
              options,
              closed: false,
              finishOpen: () => Deferred.doneUnsafe(gate, Effect.void),
              failOpen: (error) => Deferred.doneUnsafe(gate, Effect.fail(error)),
              warm: () => Deferred.doneUnsafe(warmed, Effect.void),
              lose: (error) => Deferred.doneUnsafe(lost, Effect.fail(error)),
            };
            opens.push(record);
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                record.closed = true;
              }),
            );
            yield* Deferred.await(gate);
            return fakeSession(warmed, lost);
          }),
      };
    }),
  );
}

const tick = Effect.sleep(2);

function harness(storedDeviceId = '') {
  const opens: FakeOpen[] = [];
  const layer = WarmMicrophone.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        fakeMicrophone(opens),
        Layer.succeed(DevicePreference, { current: Effect.succeed(storedDeviceId) }),
      ),
    ),
  );
  function run<A, E>(program: (warm: WarmMicrophone['Service']) => Effect.Effect<A, E>) {
    return Effect.gen(function* () {
      const warm = yield* WarmMicrophone;
      return yield* program(warm);
    }).pipe(Effect.provide(layer), Effect.scoped, Effect.runPromise);
  }
  return { opens, run };
}

function statusOf(warm: WarmMicrophone['Service']) {
  return SubscriptionRef.get(warm.snapshot);
}

describe('warm microphone', () => {
  it('opens only while practice is active and releases the device when it ends', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        expect(yield* warm.ensure).toBeNull();
        yield* warm.setActive(true);
        yield* tick;
        expect(opens).toHaveLength(1);
        expect((yield* statusOf(warm)).status).toBe('opening');
        yield* warm.setActive(false);
        yield* tick;
        expect(opens[0]?.closed).toBe(true);
        expect((yield* statusOf(warm)).status).toBe('off');
      }),
    );
  });

  it('moves through warming to ready as the session reports progress', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* tick;
        opens[0]?.finishOpen();
        yield* tick;
        expect((yield* statusOf(warm)).status).toBe('warming');
        opens[0]?.warm();
        yield* tick;
        expect((yield* statusOf(warm)).status).toBe('ready');
      }),
    );
  });

  it('hands out the opening session so a capture can wait for it', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        const slot = yield* warm.ensure;
        if (!slot) return yield* Effect.die('expected an open slot');
        yield* tick;
        opens[0]?.finishOpen();
        const session = yield* Deferred.await(slot.session);
        expect(session.input).toEqual(INPUT);
      }),
    );
  });

  it('pause releases the device and ensure reopens it', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* warm.pause;
        yield* tick;
        expect(opens[0]?.closed).toBe(true);
        expect((yield* statusOf(warm)).status).toBe('paused');
        const reopened = yield* warm.ensure;
        yield* tick;
        expect(reopened).not.toBeNull();
        expect(opens).toHaveLength(2);
        expect((yield* statusOf(warm)).status).toBe('opening');
      }),
    );
  });
});

describe('warm microphone failures', () => {
  it('reports a session that breaks once and retries only when asked', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* tick;
        opens[0]?.finishOpen();
        yield* tick;
        opens[0]?.lose(microphoneNotReady);
        yield* tick;
        expect(yield* statusOf(warm)).toEqual({
          status: 'error',
          error: microphoneNotReady.message,
        });
        expect(opens).toHaveLength(1);
        expect(opens[0]?.closed).toBe(true);
        yield* warm.resume;
        yield* tick;
        expect(opens).toHaveLength(2);
        expect((yield* statusOf(warm)).error).toBe('');
      }),
    );
  });

  it('reports a microphone that cannot be opened', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* tick;
        opens[0]?.failOpen(microphoneDisconnected);
        yield* tick;
        expect(yield* statusOf(warm)).toEqual({
          status: 'error',
          error: microphoneDisconnected.message,
        });
        expect(opens[0]?.closed).toBe(true);
      }),
    );
  });

  it('ignores signals from a session that was replaced', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* tick;
        opens[0]?.finishOpen();
        yield* tick;
        yield* warm.setDeviceId('usb');
        yield* tick;
        expect(opens[0]?.closed).toBe(true);
        expect(opens[1]?.options.deviceId).toBe('usb');
        opens[0]?.lose(microphoneNotReady);
        yield* tick;
        expect((yield* statusOf(warm)).status).toBe('opening');
      }),
    );
  });
});

describe('warm microphone configuration', () => {
  it('releases and reopens the active stream when echo cancellation changes', async () => {
    const { run, opens } = harness();
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* tick;
        yield* warm.setEchoCancellation(true);
        yield* tick;
        expect(opens).toHaveLength(2);
        expect(opens[0]?.closed).toBe(true);
        expect(opens[1]?.options.echoCancellation).toBe(true);
        yield* warm.setEchoCancellation(true);
        yield* tick;
        expect(opens).toHaveLength(2);
      }),
    );
  });

  it('follows the remembered device until one is chosen', async () => {
    const { run, opens } = harness('remembered-usb');
    await run((warm) =>
      Effect.gen(function* () {
        yield* warm.setActive(true);
        yield* tick;
        expect(opens[0]?.options.deviceId).toBe('remembered-usb');
        yield* warm.setDeviceId('');
        yield* tick;
        expect(opens[1]?.options.deviceId).toBe('');
      }),
    );
  });

  it('publishes the snapshot only when it changes', async () => {
    const { run } = harness();
    const seen: string[] = [];
    await run((warm) =>
      Effect.gen(function* () {
        const watcher = yield* Effect.forkChild(
          warm.snapshot.pipe(
            SubscriptionRef.changes,
            Stream.runForEach((snapshot) => Effect.sync(() => seen.push(snapshot.status))),
          ),
        );
        yield* tick;
        yield* warm.setActive(true);
        yield* warm.setActive(true);
        yield* tick;
        yield* warm.setActive(false);
        yield* tick;
        yield* Fiber.interrupt(watcher);
      }),
    );
    expect(seen).toEqual(['off', 'opening', 'off']);
  });
});
