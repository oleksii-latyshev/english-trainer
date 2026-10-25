import { describe, expect, it } from 'bun:test';
import { Effect, Layer, PubSub, Stream } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { Ipc, IpcDecodeError, IpcError, IpcEvents } from '@/core/ipc';
import {
  conversationAtom,
  conversationUpdatesAtom,
  retryCoachingAtom,
  sayAgainActiveAtom,
  sayAgainEffectsAtom,
  sayAgainViewAtom,
  secondTryAtom,
} from '../model/atoms';
import { cancelSayAgain, startSayAgain } from '../model/controls';
import { runtime } from '../model/runtime';
import { CoachingNoteService } from '../services/coaching-note-service';

Reflect.set(globalThis, 'isTauri', true);

type Backend = {
  coaching: unknown[];
  calls: Array<{ command: string; args: unknown }>;
  compareFails: boolean;
  events: PubSub.PubSub<unknown>;
};

function aBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    coaching: [{ state: 'pending' }],
    calls: [],
    compareFails: false,
    events: Effect.runSync(PubSub.unbounded<unknown>()),
    ...overrides,
  };
}

const READY = {
  state: 'ready',
  feedback: {
    focus_feedback: [
      {
        category: 'grammar',
        original: 'I work in there',
        improved: 'I work there',
        explanation: 'Drop the extra preposition.',
      },
    ],
    b2_rewrite: 'I work there as an engineer.',
  },
};

function layerOf(backend: Backend) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        backend.calls.push({ command, args });
        switch (command) {
          case 'get_practice_dialogue':
            return Effect.succeed({
              session_id: 7,
              opening_question: 'How was your day?',
              turns: [
                {
                  learner: 'I work in there',
                  assistant_reply: 'Nice.',
                  assistant_question: 'Why?',
                  answered_by: null,
                },
              ],
              input_sources: ['voice'],
              reply_times_ms: [null],
              answer_durations_ms: [null],
              help_used: [false],
              coaching: backend.coaching,
            });
          case 'retry_practice_turn':
            if (backend.compareFails) {
              return Effect.fail(new IpcError({ code: 'unavailable', message: 'Try later.' }));
            }
            return Effect.succeed({
              turn_sequence: 1,
              original_transcript: 'I work in there',
              retry_transcript: String(Reflect.get(args ?? {}, 'transcript')),
              target: 'I work there',
              target_evidence: 'newly_observed_in_retry',
              word_count_change: 0,
              hesitation: 'Not measured from transcript text.',
            });
          case 'retry_answer_coaching':
            backend.coaching = [{ state: 'pending' }];
            return Effect.succeed(null);
          default:
            return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected' }));
        }
      }),
  });
  const events = Layer.succeed(IpcEvents, {
    listen: () => Stream.fromPubSub(backend.events) as never,
    listenAll: () => Stream.empty,
  });
  return CoachingNoteService.layer.pipe(Layer.provide(Layer.mergeAll(ipc, events)));
}

function opened(backend: Backend) {
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layerOf(backend)]] });
  registry.mount(conversationAtom(7));
  registry.mount(conversationUpdatesAtom(7));
  registry.mount(sayAgainEffectsAtom);
  return registry;
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the review never reached the expected state');
}

function coachingOf(registry: AtomRegistry.AtomRegistry) {
  const value = AsyncResult.value(registry.get(conversationAtom(7)));
  return value._tag === 'Some' ? value.value.coaching?.[0] : undefined;
}

const TARGET = { sessionId: 7, sequence: 1 };

describe('the conversation under review', () => {
  it('loads the saved answers with their coaching state', async () => {
    const registry = opened(aBackend());
    await until(() => coachingOf(registry) !== undefined);
    expect(coachingOf(registry)).toEqual({ state: 'pending' });
  });

  it('fills a pending answer in when coaching lands for this session', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => coachingOf(registry)?.state === 'pending');
    backend.coaching = [READY];
    PubSub.publishUnsafe(backend.events, { session_id: 7 });
    await until(() => coachingOf(registry)?.state === 'ready');
  });

  it('keeps the earlier answers while it reads again', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => coachingOf(registry) !== undefined);
    backend.coaching = [READY];
    PubSub.publishUnsafe(backend.events, { session_id: 7 });
    expect(coachingOf(registry)).toBeDefined();
  });

  it('asks Rust to check an answer again and reads the pending state', async () => {
    const backend = aBackend({ coaching: [{ state: 'failed' }] });
    const registry = opened(backend);
    await until(() => coachingOf(registry)?.state === 'failed');
    registry.mount(retryCoachingAtom('7:1'));
    registry.set(retryCoachingAtom('7:1'), TARGET);
    await until(() => coachingOf(registry)?.state === 'pending');
    expect(backend.calls).toContainEqual({
      command: 'retry_answer_coaching',
      args: { sessionId: 7, sequence: 1 },
    });
  });
});

describe('say it again', () => {
  it('compares a transcript with the first try and shows the result under that answer', async () => {
    const backend = aBackend({ coaching: [READY] });
    const registry = opened(backend);
    startSayAgain(registry, TARGET);
    expect(registry.get(sayAgainActiveAtom)).toBe(true);
    registry.set(captureStateAtom, {
      tag: 'transcript',
      text: 'I work there as an engineer',
      durationMs: 1500,
      speechStoppedAtMs: 1400,
    });
    await until(() => registry.get(secondTryAtom('7:1')) !== undefined);
    expect(registry.get(secondTryAtom('7:1'))?.retry_transcript).toBe(
      'I work there as an engineer',
    );
    expect(registry.get(sayAgainActiveAtom)).toBe(false);
    expect(backend.calls).toContainEqual({
      command: 'retry_practice_turn',
      args: { sessionId: 7, sequence: 1, transcript: 'I work there as an engineer' },
    });
  });

  it('leaves the other answers waiting while one is being re-spoken', () => {
    const registry = opened(aBackend({ coaching: [READY] }));
    startSayAgain(registry, TARGET);
    expect(registry.get(sayAgainViewAtom('7:2')).tag).toBe('busy');
  });

  it('reports a failed comparison and lets the learner try again', async () => {
    const backend = aBackend({ coaching: [READY], compareFails: true });
    const registry = opened(backend);
    registry.mount(sayAgainViewAtom('7:1'));
    startSayAgain(registry, TARGET);
    registry.set(captureStateAtom, {
      tag: 'transcript',
      text: 'I work there',
      durationMs: 900,
      speechStoppedAtMs: 800,
    });
    await until(() => registry.get(sayAgainViewAtom('7:1')).tag === 'failed');
    const view = registry.get(sayAgainViewAtom('7:1'));
    expect(view.tag === 'failed' && view.message).toBe('Try later.');
    expect(registry.get(secondTryAtom('7:1'))).toBeUndefined();
  });

  it('cancelling drops the target and any message', () => {
    const registry = opened(aBackend({ coaching: [READY] }));
    startSayAgain(registry, TARGET);
    cancelSayAgain(registry);
    expect(registry.get(sayAgainActiveAtom)).toBe(false);
    expect(registry.get(sayAgainViewAtom('7:1')).tag).toBe('idle');
  });
});
