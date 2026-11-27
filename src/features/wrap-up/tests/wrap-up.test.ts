import { describe, expect, it } from 'bun:test';
import { Effect, Layer, Option, PubSub, Stream } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError, IpcEvents } from '@/core/ipc';
import { LearningMemoryService } from '@/core/learning-memory';
import { wordKey } from '../helpers/word-key';
import {
  takeWordAtom,
  undoTakeAtom,
  wordTakenAtom,
  wrapupAtom,
  wrapupUpdatesAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { WrapUpService } from '../services/wrap-up-service';
import type { FinishedSession } from '../types';
import { aCard, aFinishedSession } from './builders';

Reflect.set(globalThis, 'isTauri', true);

const SESSION = 41;

type Backend = {
  summary: FinishedSession;
  calls: Array<{ command: string; args: unknown }>;
  failing: Set<string>;
  events: PubSub.PubSub<unknown>;
};

function aBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    summary: aFinishedSession(),
    calls: [],
    failing: new Set(),
    events: Effect.runSync(PubSub.unbounded<unknown>()),
    ...overrides,
  };
}

function savedAs(phrase: string, id: number) {
  return aCard({ id, phrase, created_at: Number.MAX_SAFE_INTEGER });
}

function answerOf(backend: Backend, command: string, args: unknown): unknown {
  const phrase = String(Reflect.get(args ?? {}, 'phrase'));
  const answers: Record<string, () => unknown> = {
    get_session_wrapup: () => backend.summary,
    save_phrase_card: () => savedAs(phrase, 700),
    delete_phrase_card: () => true,
  };
  return answers[command]?.();
}

function layerOf(backend: Backend) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        backend.calls.push({ command, args });
        if (backend.failing.has(command)) {
          return Effect.fail(new IpcError({ code: 'unavailable', message: 'Try later.' }));
        }
        const answer = answerOf(backend, command, args);
        return answer === undefined
          ? Effect.fail(new IpcDecodeError({ command, cause: 'unexpected' }))
          : Effect.succeed(answer);
      }),
  });
  const events = Layer.succeed(IpcEvents, {
    listen: () => Stream.empty,
    listenAll: () => Stream.fromPubSub(backend.events) as never,
  });
  return Layer.mergeAll(WrapUpService.layer, LearningMemoryService.layer).pipe(
    Layer.provide(Layer.mergeAll(ipc, events)),
    Layer.provideMerge(Reactivity.layer),
  );
}

function opened(backend: Backend) {
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layerOf(backend)]] });
  registry.mount(wrapupAtom(SESSION));
  registry.mount(wrapupUpdatesAtom(SESSION));
  return registry;
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the wrap-up never reached the expected state');
}

function summaryOf(registry: AtomRegistry.AtomRegistry): FinishedSession | undefined {
  return Option.getOrUndefined(AsyncResult.value(registry.get(wrapupAtom(SESSION))));
}

function commands(backend: Backend, name: string) {
  return backend.calls.filter((call) => call.command === name);
}

describe('the wrap-up of a finished session', () => {
  it('reads the session once the screen is open', async () => {
    const registry = opened(aBackend());
    await until(() => summaryOf(registry) !== undefined);
    expect(summaryOf(registry)?.turn_count).toBe(3);
  });

  it('fills in the checked answers when coaching lands for this session', async () => {
    const backend = aBackend({ summary: aFinishedSession({ pending_coaching: 1 }) });
    const registry = opened(backend);
    await until(() => summaryOf(registry)?.pending_coaching === 1);
    backend.summary = aFinishedSession({ pending_coaching: 0 });
    PubSub.publishUnsafe(backend.events, Option.some({ session_id: SESSION }));
    await until(() => summaryOf(registry)?.pending_coaching === 0);
  });

  it('reads again once the listeners are registered, so a result in the gap is not lost', async () => {
    const backend = aBackend({ summary: aFinishedSession({ pending_coaching: 2 }) });
    const registry = opened(backend);
    await until(() => summaryOf(registry)?.pending_coaching === 2);
    backend.summary = aFinishedSession({ pending_coaching: 1 });
    PubSub.publishUnsafe(backend.events, Option.none());
    await until(() => summaryOf(registry)?.pending_coaching === 1);
  });

  it('ignores updates of another session', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => summaryOf(registry) !== undefined);
    const reads = commands(backend, 'get_session_wrapup').length;
    PubSub.publishUnsafe(backend.events, Option.some({ session_id: 99 }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(commands(backend, 'get_session_wrapup')).toHaveLength(reads);
  });
});

describe('taking a word from the Debrief', () => {
  const word = { sequence: 2, phrase: 'back up and running' };
  const key = wordKey(SESSION, word);
  const taken = {
    sessionId: SESSION,
    sequence: 2,
    phrase: 'back up and running',
    meaning: 'working again after a problem',
  };

  function openedForWords(backend: Backend) {
    const registry = opened(backend);
    registry.mount(wordTakenAtom(key));
    registry.mount(takeWordAtom(key));
    registry.mount(undoTakeAtom(key));
    return registry;
  }

  it('saves the word as a phrase with the answer it came from', async () => {
    const backend = aBackend();
    const registry = openedForWords(backend);
    registry.set(takeWordAtom(key), taken);
    await until(() => registry.get(wordTakenAtom(key)));
    expect(commands(backend, 'save_phrase_card')[0]?.args).toEqual({
      phrase: 'back up and running',
      meaning_or_note: 'working again after a problem',
      session_id: SESSION,
      sequence: 2,
    });
  });

  it('takes the save back when undone', async () => {
    const backend = aBackend();
    const registry = openedForWords(backend);
    registry.set(takeWordAtom(key), taken);
    await until(() => registry.get(wordTakenAtom(key)));
    registry.set(undoTakeAtom(key), 700);
    await until(() => !registry.get(wordTakenAtom(key)));
    expect(commands(backend, 'delete_phrase_card')[0]?.args).toEqual({ phrase_id: 700 });
  });

  it('does not mark the word taken when saving fails', async () => {
    const backend = aBackend();
    backend.failing.add('save_phrase_card');
    const registry = openedForWords(backend);
    registry.set(takeWordAtom(key), taken);
    await until(() => AsyncResult.isFailure(registry.get(takeWordAtom(key))));
    expect(registry.get(wordTakenAtom(key))).toBe(false);
  });

  it('keeps two answers that share a phrase apart', async () => {
    const backend = aBackend();
    const registry = openedForWords(backend);
    const other = wordKey(SESSION, { sequence: 3, phrase: 'back up and running' });
    registry.mount(wordTakenAtom(other));
    registry.set(takeWordAtom(key), taken);
    await until(() => registry.get(wordTakenAtom(key)));
    expect(registry.get(wordTakenAtom(other))).toBe(false);
  });
});
