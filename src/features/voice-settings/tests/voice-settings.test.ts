import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { IpcError } from '@/core/ipc';
import { speechVoiceAtom } from '@/core/voice-preference';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { VOICE_SAMPLE } from '../helpers/voice-options';
import {
  naturalVoiceAvailabilityAtom,
  previewingVoiceAtom,
  previewVoiceAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { VoicePreviewService } from '../services/voice-preview-service';

installFakeLocalStorage();

function makeFakeEngine() {
  const engine = {
    prewarms: 0,
    synthesized: [] as { text: string; voiceId: number; speed: number }[],
    started: 0,
    stopped: 0,
    failing: false,
  };
  const layer = Layer.succeed(VoicePreviewService, {
    prewarm: Effect.sync(() => {
      engine.prewarms++;
      return true;
    }),
    synthesize: (text, voiceId, speed) =>
      Effect.suspend(() => {
        engine.synthesized.push({ text, voiceId, speed });
        return engine.failing
          ? Effect.fail(new IpcError({ code: 'unavailable', message: 'No local voice.' }))
          : Effect.succeed(new ArrayBuffer(8));
      }),
    play: () =>
      Effect.sync(() => {
        engine.started++;
      }).pipe(
        Effect.andThen(Effect.never),
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            engine.stopped++;
          }),
        ),
      ),
  });
  return { engine, layer };
}

function makeRegistry() {
  const fake = makeFakeEngine();
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, fake.layer]] });
  const unmounts = [
    registry.mount(previewVoiceAtom),
    registry.mount(previewingVoiceAtom),
    registry.mount(naturalVoiceAvailabilityAtom),
  ];
  function leavePage() {
    for (const unmount of unmounts) unmount();
  }
  return { registry, engine: fake.engine, leavePage };
}

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(condition()).toBe(true);
}

it('asks the engine whether the local voice is available', async () => {
  const { registry, engine } = makeRegistry();
  await until(() => registry.get(naturalVoiceAvailabilityAtom)._tag === 'Success');
  expect(engine.prewarms).toBe(1);
});

it('plays the sample in the chosen voice at the saved speed', async () => {
  const { registry, engine } = makeRegistry();
  registry.set(speechVoiceAtom, { voiceURI: null, rate: 1.1 });
  registry.set(previewVoiceAtom, 5);
  await until(() => engine.started === 1);
  expect(engine.synthesized).toEqual([{ text: VOICE_SAMPLE, voiceId: 5, speed: 1.1 }]);
  expect(registry.get(previewingVoiceAtom)).toBe(5);
});

it('stops the sample that is playing when another voice is chosen', async () => {
  const { registry, engine } = makeRegistry();
  registry.set(previewVoiceAtom, 5);
  await until(() => engine.started === 1);
  registry.set(previewVoiceAtom, 2);
  await until(() => engine.started === 2);
  expect(engine.stopped).toBe(1);
  expect(engine.synthesized.map((request) => request.voiceId)).toEqual([5, 2]);
  expect(registry.get(previewingVoiceAtom)).toBe(2);
});

it('stops the sample on request and clears the playing voice', async () => {
  const { registry, engine } = makeRegistry();
  registry.set(previewVoiceAtom, 0);
  await until(() => engine.started === 1);
  registry.set(previewVoiceAtom, Atom.Interrupt);
  await until(() => engine.stopped === 1);
  expect(registry.get(previewingVoiceAtom)).toBeNull();
});

it('stops the sample when the page is left', async () => {
  const { registry, engine, leavePage } = makeRegistry();
  registry.set(previewVoiceAtom, 0);
  await until(() => engine.started === 1);
  leavePage();
  await until(() => engine.stopped === 1);
});

it('reports a failed sample and checks the local voice again', async () => {
  const { registry, engine } = makeRegistry();
  await until(() => engine.prewarms === 1);
  engine.failing = true;
  registry.set(previewVoiceAtom, 3);
  await until(() => registry.get(previewVoiceAtom)._tag === 'Failure');
  await until(() => engine.prewarms === 2);
  expect(engine.started).toBe(0);
  expect(registry.get(previewingVoiceAtom)).toBeNull();
});
