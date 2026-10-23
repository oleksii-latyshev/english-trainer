import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import { runtime } from '../model/runtime';
import { PracticeSessions } from '../services/practice-session-service';
import { aPracticeSession } from './builders';

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
}
Reflect.set(globalThis, 'isTauri', true);

export type Backend = {
  active: unknown;
  failing: Set<string>;
  calls: Array<{ command: string; args: unknown }>;
};

export function makeBackend(overrides: Partial<Backend> = {}): Backend {
  return { active: null, failing: new Set(), calls: [], ...overrides };
}

function answer(backend: Backend, command: string, args: unknown): unknown {
  switch (command) {
    case 'get_active_practice_session':
      return backend.active;
    case 'start_practice_session':
    case 'start_mistake_practice':
      return aPracticeSession({ session_id: 12, opening_question: 'Tell me about your week.' });
    case 'transition_practice_phase':
      return aPracticeSession({
        session_id: 12,
        practice_mode: 'write_then_speak',
        practice_phase: Reflect.get(args ?? {}, 'phase'),
        turn_count: 2,
        written_turn_count: 2,
      });
    case 'finish_practice_session':
      return { session_id: 12, finished: true };
    case 'set_practice_clock':
      return aPracticeSession({ session_id: 12, active_duration_ms: 5000 });
    default:
      return new IpcDecodeError({ command, cause: 'unexpected command' });
  }
}

function fakeIpc(backend: Backend) {
  return Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        backend.calls.push({ command, args });
        if (backend.failing.has(command)) {
          return Effect.fail(new IpcError({ code: 'unavailable', message: `${command} failed` }));
        }
        const result = answer(backend, command, args);
        return result instanceof IpcDecodeError ? Effect.fail(result) : Effect.succeed(result);
      }),
  });
}

export function openRegistry(backend: Backend) {
  return AtomRegistry.make({
    initialValues: [[runtime.layer, PracticeSessions.layer.pipe(Layer.provide(fakeIpc(backend)))]],
  });
}

export async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the session never reached the expected state');
}
