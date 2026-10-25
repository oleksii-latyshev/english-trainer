import { describe, expect, it } from 'bun:test';
import { Effect, Layer, PubSub, Stream } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError, IpcEvents } from '@/core/ipc';
import { type PracticeState, practiceStateAtom } from '@/core/practice-session';
import { pendingReplyAtom } from '@/core/practice-turn';
import {
  coachingUpdatesAtom,
  dialogueRefreshAtom,
  dialogueViewAtom,
  visiblePendingReplyAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { DialogueService } from '../services/dialogue-service';
import { aSessionDetails } from './builders';

Reflect.set(globalThis, 'isTauri', true);

type Backend = {
  turns: number;
  reads: number;
  fails: boolean;
  events: PubSub.PubSub<unknown>;
};

function aBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    turns: 1,
    reads: 0,
    fails: false,
    events: Effect.runSync(PubSub.unbounded<unknown>()),
    ...overrides,
  };
}

function dialogueOf(sessionId: number, turns: number) {
  return {
    session_id: sessionId,
    opening_question: 'How was your day?',
    turns: Array.from({ length: turns }, (_, index) => ({
      learner: `Answer ${index + 1}`,
      assistant_reply: 'Nice.',
      assistant_question: 'Why?',
      answered_by: null,
    })),
    input_sources: Array.from({ length: turns }, () => 'text'),
    reply_times_ms: Array.from({ length: turns }, () => null),
    answer_durations_ms: Array.from({ length: turns }, () => null),
    help_used: Array.from({ length: turns }, () => false),
    coaching: Array.from({ length: turns }, () => ({ state: 'pending' })),
  };
}

function layerOf(backend: Backend) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        if (command !== 'get_practice_dialogue') {
          return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected' }));
        }
        backend.reads += 1;
        if (backend.fails) {
          return Effect.fail(new IpcError({ code: 'database_error', message: 'Unreadable.' }));
        }
        return Effect.succeed(
          dialogueOf(Number(Reflect.get(args ?? {}, 'sessionId')), backend.turns),
        );
      }),
  });
  const events = Layer.succeed(IpcEvents, {
    listen: () => Stream.fromPubSub(backend.events) as never,
    listenAll: () => Stream.empty,
  });
  return DialogueService.layer.pipe(Layer.provide(Layer.mergeAll(ipc, events)));
}

function active(turnCount: number): PracticeState {
  return { tag: 'active', ...aSessionDetails({ turnCount }) };
}

function opened(backend: Backend, state: PracticeState = active(1)) {
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layerOf(backend)]] });
  registry.set(practiceStateAtom, state);
  registry.mount(dialogueViewAtom);
  registry.mount(coachingUpdatesAtom);
  return registry;
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the dialogue never reached the expected state');
}

describe('the conversation history', () => {
  it('loads the saved turns of the open session', async () => {
    const registry = opened(aBackend({ turns: 2 }));
    await until(() => registry.get(dialogueViewAtom).dialogue !== null);
    expect(registry.get(dialogueViewAtom).dialogue?.turns).toHaveLength(2);
  });

  it('reads again when a turn is saved', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => backend.reads === 1);
    backend.turns = 2;
    registry.set(practiceStateAtom, active(2));
    await until(() => registry.get(dialogueViewAtom).dialogue?.turns.length === 2);
  });

  it('reads again when coaching landed for this session only', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => backend.reads === 1);
    PubSub.publishUnsafe(backend.events, { session_id: 7 });
    await until(() => registry.get(dialogueRefreshAtom) === 1);
  });

  it('keeps the earlier history and reports a failed refresh', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => registry.get(dialogueViewAtom).dialogue !== null);
    backend.fails = true;
    registry.update(dialogueRefreshAtom, (tick) => tick + 1);
    await until(() => registry.get(dialogueViewAtom).hasFailed);
    expect(registry.get(dialogueViewAtom).dialogue?.turns).toHaveLength(1);
  });
});

describe('the reply that is still arriving', () => {
  it('shows the streaming text until the saved history has caught up', async () => {
    const registry = opened(aBackend({ turns: 1 }));
    registry.mount(visiblePendingReplyAtom);
    await until(() => registry.get(dialogueViewAtom).dialogue !== null);
    registry.set(pendingReplyAtom, { sessionId: 7, text: 'Sounds', savedTurnCount: 2 });
    expect(registry.get(visiblePendingReplyAtom)).toBe('Sounds');
    registry.set(pendingReplyAtom, { sessionId: 7, text: 'Sounds', savedTurnCount: 1 });
    expect(registry.get(visiblePendingReplyAtom)).toBeUndefined();
  });

  it('ignores a reply that belongs to another session', async () => {
    const registry = opened(aBackend());
    registry.mount(visiblePendingReplyAtom);
    registry.set(pendingReplyAtom, { sessionId: 99, text: 'Late', savedTurnCount: 5 });
    expect(registry.get(visiblePendingReplyAtom)).toBeUndefined();
  });
});
