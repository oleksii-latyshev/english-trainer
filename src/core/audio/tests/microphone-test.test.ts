import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Layer, Stream, SubscriptionRef } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import type { ActualAudioInput, RecordedAudio } from '../audio';
import {
  clipPhaseAtom,
  microphoneTestAtom,
  microphoneTestRunAtom,
  stopClipAtom,
} from '../model/atoms';
import { audioAtomRuntime } from '../model/runtime';
import { AudioInputsService } from '../services/audio-inputs-service';
import { ClipRecorder } from '../services/clip-recorder-service';
import { Microphone } from '../services/microphone-service';

const INPUT: ActualAudioInput = { deviceId: 'usb', label: 'USB microphone' };
const AUDIO: RecordedAudio = {
  wav: new Blob(['wav']),
  durationMs: 3000,
  signal: { capturedMs: 3000, elapsedMs: 3100, windows: [] },
};

function makeRegistry() {
  const urls = { created: [] as string[], revoked: [] as string[] };
  let counter = 0;
  Object.assign(URL, {
    createObjectURL: () => {
      counter += 1;
      const url = `blob:clip-${counter}`;
      urls.created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => void urls.revoked.push(url),
  });
  const microphone = Layer.effect(
    Microphone,
    Effect.gen(function* () {
      const lastInput = yield* SubscriptionRef.make<ActualAudioInput | null>(null);
      return {
        lastInput,
        open: () =>
          Effect.succeed({
            input: INPUT,
            frames: Stream.empty,
            levels: Stream.empty,
            level: Effect.succeed(0),
            noiseFloor: Effect.succeed(0),
            isWarm: Effect.succeed(true),
            warmed: Effect.void,
            lost: Deferred.await(Deferred.makeUnsafe<never, never>()),
            echoCancellationEnabled: Effect.succeed(false),
            capture: () =>
              Effect.succeed({
                level: Effect.succeed(0.4),
                snapshot: () => Effect.succeed(null),
                stop: Effect.succeed(AUDIO),
              }),
            turns: () => Stream.empty,
            speechOnsets: () => Stream.empty,
          }),
      };
    }),
  );
  const inputs = Layer.succeed(AudioInputsService, {
    list: Effect.succeed({ options: [], hasUnnamed: false }),
    changes: Stream.empty,
  });
  const layer = Layer.mergeAll(
    Layer.fresh(ClipRecorder.layer).pipe(Layer.provide(microphone)),
    inputs,
  );
  const registry = AtomRegistry.make({ initialValues: [[audioAtomRuntime.layer, layer]] });
  registry.mount(microphoneTestAtom);
  registry.mount(clipPhaseAtom);
  return { registry, urls };
}

async function until(registry: AtomRegistry.AtomRegistry, tag: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (registry.get(microphoneTestAtom).tag === tag) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`never reached ${tag}, now ${JSON.stringify(registry.get(microphoneTestAtom))}`);
}

describe('microphone test', () => {
  it('records while the learner speaks and offers the clip afterwards', async () => {
    const { registry } = makeRegistry();
    registry.set(microphoneTestRunAtom, 'usb');
    await until(registry, 'recording');
    registry.set(stopClipAtom, undefined);
    await until(registry, 'recorded');
    const state = registry.get(microphoneTestAtom);
    expect(state.tag === 'recorded' && state.durationMs).toBe(3000);
    expect(state.tag === 'recorded' && state.playbackUrl).toBe('blob:clip-1');
  });

  it('discarding the clip frees its playback url and goes back to idle', async () => {
    const { registry, urls } = makeRegistry();
    registry.set(microphoneTestRunAtom, 'usb');
    await until(registry, 'recording');
    registry.set(stopClipAtom, undefined);
    await until(registry, 'recorded');
    registry.set(microphoneTestRunAtom, Atom.Reset);
    await until(registry, 'idle');
    expect(urls.revoked).toEqual(['blob:clip-1']);
  });

  it('a new recording frees the previous clip', async () => {
    const { registry, urls } = makeRegistry();
    registry.set(microphoneTestRunAtom, 'usb');
    await until(registry, 'recording');
    registry.set(stopClipAtom, undefined);
    await until(registry, 'recorded');
    registry.set(microphoneTestRunAtom, 'usb');
    await until(registry, 'recording');
    expect(urls.revoked).toEqual(['blob:clip-1']);
  });

  it('discarding while recording releases the microphone', async () => {
    const { registry } = makeRegistry();
    registry.set(microphoneTestRunAtom, 'usb');
    await until(registry, 'recording');
    registry.set(microphoneTestRunAtom, Atom.Reset);
    await until(registry, 'idle');
    const phase = registry.get(clipPhaseAtom);
    expect(phase._tag === 'Success' && phase.value.tag).toBe('idle');
  });
});
