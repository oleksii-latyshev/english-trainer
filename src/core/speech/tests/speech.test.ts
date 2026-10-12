import { expect, it } from 'bun:test';
import { Layer } from 'effect';
import { Atom, AtomRegistry } from 'effect/reactivity';
import { startReplyLog } from '../helpers/reply-log';
import {
  naturalAvailabilityAtom,
  previewingNaturalVoiceAtom,
  previewNaturalVoiceAtom,
  replyLogAtom,
  speakAtom,
  speechStateAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { Speech } from '../services/speech-service';
import type { SpeechEngineChoice, StreamOptions } from '../types';
import { fakeSpeechEdges, type NaturalBehaviour } from './fakes';

const NATURAL: SpeechEngineChoice = { kind: 'natural', voiceId: 0, fallbackVoiceURI: null };
const QUICK: NaturalBehaviour = { latencyMs: () => 5 };

function makeRegistry(behaviour: NaturalBehaviour = QUICK) {
  const edges = fakeSpeechEdges(behaviour);
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, Speech.layer.pipe(Layer.provide(edges.layer))]],
  });
  const unmounts = [
    registry.mount(speakAtom),
    registry.mount(speechStateAtom),
    registry.mount(replyLogAtom),
    registry.mount(naturalAvailabilityAtom),
    registry.mount(previewNaturalVoiceAtom),
    registry.mount(previewingNaturalVoiceAtom),
  ];
  return {
    registry,
    edges,
    leavePage: () => {
      for (const unmount of unmounts) unmount();
    },
  };
}

function beginStream(
  registry: AtomRegistry.AtomRegistry,
  options: StreamOptions,
  engine: SpeechEngineChoice = NATURAL,
) {
  registry.set(replyLogAtom, startReplyLog(1));
  registry.set(speakAtom, { streamId: 1, engine, rate: 1, options });
}

function appendReply(registry: AtomRegistry.AtomRegistry, delta: string) {
  const log = registry.get(replyLogAtom);
  registry.set(replyLogAtom, { ...log, deltas: [...log.deltas, delta] });
}

function finishReply(registry: AtomRegistry.AtomRegistry, text: string) {
  registry.set(replyLogAtom, { ...registry.get(replyLogAtom), final: text });
}

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 600 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(condition()).toBe(true);
}

it('asks the engine whether the local voice is available', async () => {
  const { registry, edges } = makeRegistry();

  await until(() => registry.get(naturalAvailabilityAtom)._tag === 'Success');

  expect(edges.engine.prewarms).toBe(1);
});

it('speaks sentences streamed through the reply log and reports start and end', async () => {
  const { registry, edges } = makeRegistry();
  const events: string[] = [];
  beginStream(registry, {
    onStart: () => events.push('start'),
    onEnd: () => events.push('end'),
  });

  appendReply(registry, 'Hi there. ');
  await until(() => edges.requests.length === 1);
  appendReply(registry, 'Nice to meet you.');
  finishReply(registry, 'Hi there. Nice to meet you.');
  await until(() => events.includes('end'));

  expect(edges.requests.map((request) => request.text)).toEqual(['Hi there.', 'Nice to meet you.']);
  expect(events).toEqual(['start', 'end']);
  expect(registry.get(speechStateAtom)).toEqual({ tag: 'idle' });
});

it('a failed local voice hands the sentence to the system voice and checks the engine again', async () => {
  const { registry, edges } = makeRegistry({ ...QUICK, failure: () => 'unavailable' });
  const events: string[] = [];
  await until(() => edges.engine.prewarms === 1);
  beginStream(registry, { onEnd: () => events.push('end') });

  finishReply(registry, 'Hi there.');
  await until(() => events.includes('end'));

  expect(edges.spoken.map((utterance) => utterance.text)).toEqual(['Hi there.']);
  await until(() => edges.engine.prewarms === 2);
});

it('interrupting stops the speech and nothing is reported afterwards', async () => {
  const { registry, edges } = makeRegistry({ latencyMs: () => 100 });
  const events: string[] = [];
  beginStream(registry, { onStart: () => events.push('start'), onEnd: () => events.push('end') });
  finishReply(registry, 'Hi there.');
  await until(() => edges.requests.length === 1);

  registry.set(speakAtom, Atom.Interrupt);
  await new Promise((resolve) => setTimeout(resolve, 250));

  expect(events).toEqual([]);
  expect(edges.clips).toEqual([]);
  await until(() => edges.closedSessions.length === 1);
});

it('replacing a stream stops the previous one', async () => {
  const { registry, edges } = makeRegistry({ latencyMs: () => 100 });
  const events: string[] = [];
  beginStream(registry, { onEnd: () => events.push('first-end') });
  finishReply(registry, 'First reply.');
  await until(() => edges.requests.length === 1);

  registry.set(replyLogAtom, startReplyLog(2));
  registry.set(speakAtom, {
    streamId: 2,
    engine: NATURAL,
    rate: 1,
    options: { onEnd: () => events.push('second-end') },
  });
  finishReply(registry, 'Second reply.');
  await until(() => events.includes('second-end'));

  expect(events).toEqual(['second-end']);
  expect(edges.clips).toHaveLength(1);
});

it('plays the sample in the chosen voice at the given speed', async () => {
  const { registry, edges } = makeRegistry();

  registry.set(previewNaturalVoiceAtom, { text: 'Hi!', voiceId: 5, rate: 1.1 });
  await until(() => edges.clips.length === 1);

  expect(edges.requests.map((request) => request.text)).toEqual(['Hi!']);
  expect(registry.get(previewingNaturalVoiceAtom)).toBe(5);
});

it('stops the sample on request and clears the playing voice', async () => {
  const { registry, edges } = makeRegistry();
  registry.set(previewNaturalVoiceAtom, {
    text: 'Hi, this is a longer sample.',
    voiceId: 0,
    rate: 1,
  });
  await until(() => edges.clips.length === 1);

  registry.set(previewNaturalVoiceAtom, Atom.Interrupt);

  await until(() => edges.closedSessions.length === 1);
  expect(registry.get(previewingNaturalVoiceAtom)).toBeNull();
});

it('stops the sample when the page is left', async () => {
  const { registry, edges, leavePage } = makeRegistry();
  registry.set(previewNaturalVoiceAtom, {
    text: 'Hi, this is a longer sample.',
    voiceId: 0,
    rate: 1,
  });
  await until(() => edges.clips.length === 1);

  leavePage();

  await until(() => edges.closedSessions.length === 1);
});

it('reports a failed sample and checks the local voice again', async () => {
  const { registry, edges } = makeRegistry({ ...QUICK, failure: () => 'unavailable' });
  await until(() => edges.engine.prewarms === 1);

  registry.set(previewNaturalVoiceAtom, { text: 'Hi!', voiceId: 3, rate: 1 });

  await until(() => registry.get(previewNaturalVoiceAtom)._tag === 'Failure');
  await until(() => edges.engine.prewarms === 2);
  expect(edges.clips).toEqual([]);
  expect(registry.get(previewingNaturalVoiceAtom)).toBeNull();
});
