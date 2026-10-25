import { describe, expect, it } from 'bun:test';
import { Effect, Layer, Option, PubSub, Stream } from 'effect';
import { AsyncResult, AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError, IpcEvents } from '@/core/ipc';
import { LearningMemoryService } from '@/core/learning-memory';
import { answerKey } from '../helpers/answer-key';
import {
  answerSavedAtom,
  phraseSelectionAtom,
  retryPreparationAtom,
  saveAnswerAtom,
  savePhrasesAtom,
  undoAnswerAtom,
  undoPhrasesAtom,
  wrapupAtom,
  wrapupUpdatesAtom,
} from '../model/atoms';
import { removeWrapupPhrase } from '../model/controls';
import { runtime } from '../model/runtime';
import { WrapUpService } from '../services/wrap-up-service';
import type { FinishedSession } from '../types';
import { aCard, aFinishedSession, aPhrase } from './builders';

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
    summary: aFinishedSession({
      phrases: [aPhrase(), aPhrase({ phrase: 'I tend to plan ahead.' })],
    }),
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
  const phrases = Reflect.get(args ?? {}, 'phrases') as string[] | undefined;
  const phrase = String(Reflect.get(args ?? {}, 'phrase'));
  const cards = (phrases ?? []).map((item, index) => savedAs(item, 500 + index));
  const answers: Record<string, () => unknown> = {
    get_session_wrapup: () => backend.summary,
    retry_session_wrapup: () => {
      backend.summary = { ...backend.summary, wrapup_preparation: { state: 'pending' } };
      return null;
    },
    save_wrapup_phrases: () => ({ cards, created_ids: cards.map((card) => card.id) }),
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
  registry.mount(phraseSelectionAtom(SESSION));
  registry.mount(savePhrasesAtom(SESSION));
  registry.mount(undoPhrasesAtom(SESSION));
  registry.mount(retryPreparationAtom(SESSION));
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
    expect(summaryOf(registry)?.phrases).toHaveLength(2);
  });

  it('fills in phrases when preparation or coaching lands for this session', async () => {
    const backend = aBackend({
      summary: aFinishedSession({ wrapup_preparation: { state: 'pending' }, pending_coaching: 1 }),
    });
    const registry = opened(backend);
    await until(() => summaryOf(registry)?.wrapup_preparation.state === 'pending');
    backend.summary = aFinishedSession({ phrases: [aPhrase()], pending_coaching: 0 });
    PubSub.publishUnsafe(backend.events, Option.some({ session_id: SESSION }));
    await until(() => summaryOf(registry)?.phrases.length === 1);
    expect(summaryOf(registry)?.pending_coaching).toBe(0);
  });

  it('reads again once the listeners are registered, so a result in the gap is not lost', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => summaryOf(registry)?.phrases.length === 2);
    backend.summary = aFinishedSession({ phrases: [aPhrase()] });
    PubSub.publishUnsafe(backend.events, Option.none());
    await until(() => summaryOf(registry)?.phrases.length === 1);
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

describe('saving the phrases', () => {
  it('saves what is left after removals and marks it saved', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    removeWrapupPhrase(registry, SESSION, 'I tend to plan ahead.');
    registry.set(savePhrasesAtom(SESSION), ['It saves me time.']);
    await until(() => registry.get(phraseSelectionAtom(SESSION)).saved.size === 1);
    expect(commands(backend, 'save_wrapup_phrases')[0]?.args).toEqual({
      sessionId: SESSION,
      phrases: ['It saves me time.'],
    });
    expect(registry.get(phraseSelectionAtom(SESSION)).removed.has('I tend to plan ahead.')).toBe(
      true,
    );
  });

  it('removes only the cards this save created when it is undone', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    registry.set(savePhrasesAtom(SESSION), ['It saves me time.', 'I tend to plan ahead.']);
    await until(() => registry.get(phraseSelectionAtom(SESSION)).saved.size === 2);
    registry.set(undoPhrasesAtom(SESSION), {
      phrases: ['It saves me time.', 'I tend to plan ahead.'],
      cardIds: [500, 501],
    });
    await until(() => registry.get(phraseSelectionAtom(SESSION)).saved.size === 0);
    expect(commands(backend, 'delete_phrase_card').map((call) => call.args)).toEqual([
      { phrase_id: 500 },
      { phrase_id: 501 },
    ]);
  });

  it('keeps the phrases saved when the undo fails', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    registry.set(savePhrasesAtom(SESSION), ['It saves me time.']);
    await until(() => registry.get(phraseSelectionAtom(SESSION)).saved.size === 1);
    backend.failing.add('delete_phrase_card');
    registry.set(undoPhrasesAtom(SESSION), { phrases: ['It saves me time.'], cardIds: [500] });
    await until(() => commands(backend, 'delete_phrase_card').length === 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(registry.get(phraseSelectionAtom(SESSION)).saved.size).toBe(1);
  });

  it('reports a failed save and leaves the phrases unsaved', async () => {
    const backend = aBackend();
    backend.failing.add('save_wrapup_phrases');
    const registry = opened(backend);
    registry.set(savePhrasesAtom(SESSION), ['It saves me time.']);
    await until(() => AsyncResult.isFailure(registry.get(savePhrasesAtom(SESSION))));
    expect(registry.get(phraseSelectionAtom(SESSION)).saved.size).toBe(0);
  });
});

describe('preparing phrases again', () => {
  it('asks Rust to retry and reads the session again', async () => {
    const backend = aBackend({
      summary: aFinishedSession({
        wrapup_preparation: { state: 'failed', error: { code: 'timeout', message: 'Timed out.' } },
      }),
    });
    const registry = opened(backend);
    await until(() => summaryOf(registry)?.wrapup_preparation.state === 'failed');
    registry.set(retryPreparationAtom(SESSION), undefined);
    await until(() => summaryOf(registry)?.wrapup_preparation.state === 'pending');
    expect(commands(backend, 'retry_session_wrapup')[0]?.args).toEqual({ sessionId: SESSION });
  });

  it('keeps the failure for the retry button when Rust refuses', async () => {
    const backend = aBackend();
    backend.failing.add('retry_session_wrapup');
    const registry = opened(backend);
    registry.set(retryPreparationAtom(SESSION), undefined);
    await until(() => AsyncResult.isFailure(registry.get(retryPreparationAtom(SESSION))));
  });
});

describe('saving the better version of one answer', () => {
  const key = answerKey(SESSION, 2);
  const answer = { sessionId: SESSION, sequence: 2, phrase: 'I work there', note: 'Drop in.' };

  function openedForAnswers(backend: Backend) {
    const registry = opened(backend);
    registry.mount(answerSavedAtom(key));
    registry.mount(saveAnswerAtom(key));
    registry.mount(undoAnswerAtom(key));
    return registry;
  }

  it('saves the phrase with the answer it came from', async () => {
    const backend = aBackend();
    const registry = openedForAnswers(backend);
    registry.set(saveAnswerAtom(key), answer);
    await until(() => registry.get(answerSavedAtom(key)));
    expect(commands(backend, 'save_phrase_card')[0]?.args).toEqual({
      phrase: 'I work there',
      meaning_or_note: 'Drop in.',
      session_id: SESSION,
      sequence: 2,
    });
  });

  it('takes the save back when undone', async () => {
    const backend = aBackend();
    const registry = openedForAnswers(backend);
    registry.set(saveAnswerAtom(key), answer);
    await until(() => registry.get(answerSavedAtom(key)));
    registry.set(undoAnswerAtom(key), 700);
    await until(() => !registry.get(answerSavedAtom(key)));
    expect(commands(backend, 'delete_phrase_card')[0]?.args).toEqual({ phrase_id: 700 });
  });

  it('does not mark the answer saved when saving fails', async () => {
    const backend = aBackend();
    backend.failing.add('save_phrase_card');
    const registry = openedForAnswers(backend);
    registry.set(saveAnswerAtom(key), answer);
    await until(() => AsyncResult.isFailure(registry.get(saveAnswerAtom(key))));
    expect(registry.get(answerSavedAtom(key))).toBe(false);
  });
});
