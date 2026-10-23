import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { microphoneSnapshotAtom } from '@/core/audio';
import { Ipc, IpcError } from '@/core/ipc';
import {
  PracticeSessions,
  type PracticeState,
  practiceErrorAtom,
  practiceSessionRuntime,
  practiceStateAtom,
} from '@/core/practice-session';
import { sessionClockAtom } from '../model/clock';
import { aSessionDetails } from './builders';

Reflect.set(globalThis, 'isTauri', true);

type Backend = { clock: boolean[]; fails: boolean };

function layerOf(backend: Backend) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (_command, args) =>
      Effect.yieldNow.pipe(
        Effect.andThen(() => {
          backend.clock.push(Reflect.get(args ?? {}, 'running') === true);
          if (backend.fails) {
            return Effect.fail(new IpcError({ code: 'database_error', message: 'Not saved.' }));
          }
          return Effect.succeed({
            session_id: 7,
            opening_question: 'How was your day?',
            turn_count: 1,
            target_turns: 8,
            retry_evidence: [],
            topic_id: 'daily_life',
            topic_label: 'Daily life',
            topic_custom: null,
            duration_goal_seconds: 600,
            active_duration_ms: 9000,
            started_at: 1,
            is_clock_running: Reflect.get(args ?? {}, 'running') === true,
          });
        }),
      ),
  });
  return PracticeSessions.layer.pipe(Layer.provide(ipc));
}

function opened(backend: Backend, state: PracticeState) {
  const registry = AtomRegistry.make({
    initialValues: [[practiceSessionRuntime.layer, layerOf(backend)]],
  });
  registry.mount(practiceStateAtom);
  registry.mount(practiceErrorAtom);
  registry.mount(microphoneSnapshotAtom);
  registry.set(microphoneSnapshotAtom, { status: 'ready', error: '' });
  registry.set(practiceStateAtom, state);
  registry.mount(sessionClockAtom);
  return registry;
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the clock never reached the expected state');
}

describe('the session clock', () => {
  it('starts when an answerable stage opens and shows the saved time', async () => {
    const backend: Backend = { clock: [], fails: false };
    const registry = opened(backend, { tag: 'active', ...aSessionDetails() });
    await until(() => backend.clock.length >= 1);
    expect(backend.clock[0]).toBe(true);
    await until(() => {
      const state = registry.get(practiceStateAtom);
      return state.tag === 'active' && state.activeDurationMs === 9000;
    });
  });

  it('stops when the stage no longer takes answers', async () => {
    const backend: Backend = { clock: [], fails: false };
    const registry = opened(backend, { tag: 'active', ...aSessionDetails() });
    await until(() => backend.clock.length >= 1);
    registry.set(practiceStateAtom, {
      tag: 'active',
      ...aSessionDetails({ practiceMode: 'text_chat', practicePhase: 'writing_review' }),
    });
    await until(() => backend.clock[backend.clock.length - 1] === false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(backend.clock[backend.clock.length - 1]).toBe(false);
  });

  it('stays off before there is a session', async () => {
    const backend: Backend = { clock: [], fails: false };
    opened(backend, { tag: 'idle' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(backend.clock).toEqual([]);
  });

  it('says so when the time could not be saved', async () => {
    const backend: Backend = { clock: [], fails: true };
    const registry = opened(backend, { tag: 'active', ...aSessionDetails() });
    await until(() => registry.get(practiceErrorAtom) !== '');
    expect(registry.get(practiceErrorAtom)).toBe('Not saved.');
  });
});
