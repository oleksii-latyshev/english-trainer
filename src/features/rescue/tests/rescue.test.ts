import { expect, it } from 'bun:test';
import { Deferred, Effect } from 'effect';
import { captureRequestIdAtom, captureStateAtom, rescueHoldAtom } from '@/core/answer-capture';
import { IpcError } from '@/core/ipc';
import { rescueStateAtom, rescueTargetAtom } from '../model/atoms';
import {
  chooseRescueKind,
  closeRescue,
  describeMissingWord,
  findMissingWord,
  openRescue,
  retryRescue,
  selectRescueTerm,
} from '../model/commands';
import { aListening } from './builders';
import { aFakeRust, recording, rescueCalls, settle } from './harness';

it('has a target only while recording', () => {
  const { registry } = recording();
  expect(registry.get(rescueTargetAtom)?.key).toBe('7:speaking:1:How was your day?:3');
  registry.set(captureStateAtom, { tag: 'idle' });
  expect(registry.get(rescueTargetAtom)).toBeNull();
});

it('asks for a next step from the recent speech and holds the turn open without sending anything', async () => {
  const gate = Effect.runSync(Deferred.make<void>());
  const rust = aFakeRust();
  rust.rescueGate = gate;
  const { registry } = recording(rust);

  openRescue(registry);
  expect(registry.get(rescueStateAtom).tag).toBe('loading');
  expect(registry.get(rescueHoldAtom)).toBe(true);
  Effect.runSync(Deferred.succeed(gate, undefined));
  await settle();

  const state = registry.get(rescueStateAtom);
  expect(state.tag === 'answer' && state.answer).toEqual({
    kind: 'next_step',
    suggestion: 'a next_step suggestion',
  });
  expect(rescueCalls(rust)).toHaveLength(1);
  expect(rescueCalls(rust)[0]?.args).toEqual({
    session_id: 7,
    sequence: 1,
    request: {
      kind: 'next_step',
      question: 'How was your day?',
      partial_transcript: 'I use a notebook because',
      description: '',
    },
  });
  expect(rust.calls.map((call) => call.command)).toEqual(['rescue_answer']);
});

it('releases only the rescue hold when help closes', async () => {
  const { registry } = recording();
  openRescue(registry);
  await settle();

  closeRescue(registry);

  expect(registry.get(rescueStateAtom).tag).toBe('closed');
  expect(registry.get(rescueHoldAtom)).toBe(false);
});

it('switches to a simpler suggestion', async () => {
  const { registry, rust } = recording();
  openRescue(registry);
  await settle();

  chooseRescueKind(registry, 'simpler');
  await settle();

  const state = registry.get(rescueStateAtom);
  expect(state.tag === 'answer' && state.answer.kind).toBe('simpler');
  expect(rescueCalls(rust)).toHaveLength(2);
});

it('finds a missing word without listening to the answer, and selects a candidate', async () => {
  const { registry, rust } = recording();

  chooseRescueKind(registry, 'missing_word');
  expect(registry.get(rescueStateAtom)).toEqual({ tag: 'missing-word', description: '' });
  findMissingWord(registry);
  expect(registry.get(rescueStateAtom).tag).toBe('missing-word');
  describeMissingWord(registry, '  a place where I keep notes ');
  findMissingWord(registry);
  await settle();

  expect(rescueCalls(rust)[0]?.args).toMatchObject({
    request: {
      kind: 'missing_word',
      partial_transcript: '',
      description: 'a place where I keep notes',
    },
  });
  selectRescueTerm(registry, 'cache');
  expect(registry.get(rescueStateAtom)).toEqual({ tag: 'selected', term: 'cache' });
});

it('shows a provider failure, releases the hold and retries the same request', async () => {
  const rust = aFakeRust();
  rust.failRescues = 1;
  const { registry } = recording(rust);

  openRescue(registry);
  await settle();
  const failed = registry.get(rescueStateAtom);
  expect(failed.tag === 'error' && failed.failure.message).toBe('Rescue is busy.');
  expect(registry.get(rescueHoldAtom)).toBe(false);

  retryRescue(registry);
  await settle();

  const state = registry.get(rescueStateAtom);
  expect(state.tag === 'answer' && state.kind).toBe('next_step');
  expect(rescueCalls(rust)).toHaveLength(2);
});

it('keeps the mode and the description when a missing word request is retried', async () => {
  const rust = aFakeRust();
  rust.failRescues = 1;
  const { registry } = recording(rust);
  chooseRescueKind(registry, 'missing_word');
  describeMissingWord(registry, 'a short reminder');
  findMissingWord(registry);
  await settle();
  expect(registry.get(rescueStateAtom).tag).toBe('error');

  retryRescue(registry);
  await settle();

  const descriptions = rescueCalls(rust).map((call) =>
    Reflect.get(Reflect.get(call.args ?? {}, 'request') ?? {}, 'description'),
  );
  expect(descriptions).toEqual(['a short reminder', 'a short reminder']);
  expect(registry.get(rescueStateAtom).tag).toBe('answer');
});

it('reports silence without asking the provider', async () => {
  const rust = aFakeRust();
  rust.transcriptFailure = new IpcError({ code: 'no_speech', message: 'No speech yet.' });
  const { registry } = recording(rust);

  openRescue(registry);
  await settle();

  const state = registry.get(rescueStateAtom);
  expect(state.tag === 'error' && state.failure.message).toBe('No speech yet.');
  expect(rescueCalls(rust)).toHaveLength(0);
});

it('drops a late answer after help is closed', async () => {
  const gate = Effect.runSync(Deferred.make<void>());
  const rust = aFakeRust();
  rust.rescueGate = gate;
  const { registry } = recording(rust);
  openRescue(registry);
  await settle();

  closeRescue(registry);
  Effect.runSync(Deferred.succeed(gate, undefined));
  await settle();

  expect(registry.get(rescueStateAtom).tag).toBe('closed');
});

it('drops a late answer for the previous recording and lets the new one ask again', async () => {
  const gate = Effect.runSync(Deferred.make<void>());
  const rust = aFakeRust();
  rust.rescueGate = gate;
  const { registry } = recording(rust);
  openRescue(registry);
  await settle();

  registry.set(captureStateAtom, { tag: 'idle' });
  registry.set(captureRequestIdAtom, 4);
  registry.set(captureStateAtom, { tag: 'recording', ...aListening() });
  expect(registry.get(rescueStateAtom).tag).toBe('closed');
  Effect.runSync(Deferred.succeed(gate, undefined));
  await settle();
  expect(registry.get(rescueStateAtom).tag).toBe('closed');

  rust.rescueGate = null;
  openRescue(registry);
  await settle();
  expect(registry.get(rescueStateAtom).tag).toBe('answer');
});

it('ignores a second request while one is loading', async () => {
  const gate = Effect.runSync(Deferred.make<void>());
  const rust = aFakeRust();
  rust.rescueGate = gate;
  const { registry } = recording(rust);

  openRescue(registry);
  chooseRescueKind(registry, 'simpler');
  Effect.runSync(Deferred.succeed(gate, undefined));
  await settle();

  expect(rescueCalls(rust)).toHaveLength(1);
});
