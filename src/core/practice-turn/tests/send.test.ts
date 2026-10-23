import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Exit, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { IpcError } from '@/core/ipc';
import { type PracticeState, practiceStateAtom } from '@/core/practice-session';
import { aSessionDetails } from '@/core/practice-session/tests/builders';
import { interruptReplyAtom } from '../model/interrupt';
import { turnRuntime } from '../model/runtime';
import { sendTurn } from '../model/send';
import {
  generationAtom,
  outcomeRecordAtom,
  pendingReplyAtom,
  sendFailureAtom,
  sendPendingAtom,
  turnLockAtom,
} from '../model/state';
import { PracticeTurns } from '../services/practice-turn-service';

const TURN = {
  spoken_reply: 'That sounds useful.',
  question: 'How did you choose it?',
  session_phase: 'practice',
  is_complete: false,
};

type Script = {
  sent: Array<{ transcript: string; source: string }>;
  cancelled: number[];
  gate: Deferred.Deferred<void> | null;
  fails: boolean;
};

function aScript(overrides: Partial<Script> = {}): Script {
  return { sent: [], cancelled: [], gate: null, fails: false, ...overrides };
}

function fakeTurns(script: Script) {
  return Layer.succeed(PracticeTurns, {
    send: (request) =>
      Effect.gen(function* () {
        script.sent.push({ transcript: request.transcript, source: request.source });
        request.onDelta('That sounds ');
        if (script.gate) yield* Deferred.await(script.gate);
        if (script.fails) {
          return yield* new IpcError({ code: 'timeout', message: 'The model took too long.' });
        }
        return TURN;
      }),
    cancel: (sessionId) => Effect.sync(() => script.cancelled.push(sessionId) > 0),
  });
}

function textChat(overrides = {}): PracticeState {
  return {
    tag: 'active',
    ...aSessionDetails({
      practiceMode: 'text_chat',
      practicePhase: 'writing',
      turnCount: 0,
      writtenTurnCount: 0,
      spokenTurnCount: 0,
      ...overrides,
    }),
  };
}

function opened(script: Script, state: PracticeState = textChat()) {
  const registry = AtomRegistry.make({ initialValues: [[turnRuntime.layer, fakeTurns(script)]] });
  registry.mount(practiceStateAtom);
  registry.mount(pendingReplyAtom);
  registry.mount(sendFailureAtom);
  registry.set(practiceStateAtom, state);
  return registry;
}

function run(registry: AtomRegistry.AtomRegistry, script: Script, text = 'I use a notebook.') {
  return Effect.runPromiseExit(
    sendTurn(registry, { text, source: 'text', recordingMs: 0 }).pipe(
      Effect.provide(fakeTurns(script)),
    ),
  );
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the turn never reached the expected state');
}

describe('sending an answer', () => {
  it('streams the reply, moves the session on and sends the typed text', async () => {
    const script = aScript();
    const registry = opened(script);
    const exit = await run(registry, script);
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(script.sent).toEqual([{ transcript: 'I use a notebook.', source: 'text' }]);
    expect(registry.get(pendingReplyAtom)).toEqual({
      sessionId: 7,
      text: 'That sounds ',
      savedTurnCount: 1,
    });
    expect(registry.get(practiceStateAtom)).toMatchObject({
      tag: 'active',
      turnCount: 1,
      question: 'How did you choose it?',
    });
    expect(registry.get(sendPendingAtom)).toBe(false);
  });

  it('keeps the session waiting while the reply is generated', async () => {
    const gate = Deferred.makeUnsafe<void>();
    const script = aScript({ gate });
    const registry = opened(script);
    const sending = run(registry, script);
    await until(() => registry.get(practiceStateAtom).tag === 'waiting');
    expect(registry.get(sendPendingAtom)).toBe(true);
    Deferred.doneUnsafe(gate, Effect.void);
    await sending;
    expect(registry.get(practiceStateAtom).tag).toBe('active');
  });

  it('reports a failed reply and drops the unfinished text', async () => {
    const script = aScript({ fails: true });
    const registry = opened(script);
    const exit = await run(registry, script);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(registry.get(pendingReplyAtom)).toBeNull();
    expect(registry.get(sendFailureAtom)).toEqual({
      message: 'The model took too long.',
      needsSetup: false,
      isUnresponsive: true,
    });
    expect(registry.get(practiceStateAtom)).toMatchObject({ tag: 'active', turnCount: 0 });
  });
});

describe('answers that cannot be sent', () => {
  it.each([
    [
      'while the learner is recording',
      (registry: AtomRegistry.AtomRegistry) =>
        registry.set(captureStateAtom, { tag: 'requesting' }),
    ],
    [
      'while a retry or recall holds the turn',
      (registry: AtomRegistry.AtomRegistry) => registry.set(turnLockAtom, true),
    ],
  ])('is blocked %s', async (_name, block) => {
    const script = aScript();
    const registry = opened(script);
    block(registry);
    const exit = await run(registry, script);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(script.sent).toEqual([]);
  });

  it('is blocked when a spoken answer arrives in a text chat', async () => {
    const script = aScript();
    const registry = opened(script);
    const exit = await Effect.runPromiseExit(
      sendTurn(registry, { text: 'spoken', source: 'voice', recordingMs: 900 }).pipe(
        Effect.provide(fakeTurns(script)),
      ),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(script.sent).toEqual([]);
  });

  it('is blocked when the answer is empty', async () => {
    const script = aScript();
    const registry = opened(script);
    const exit = await run(registry, script, '   ');
    expect(Exit.isFailure(exit)).toBe(true);
    expect(script.sent).toEqual([]);
  });
});

describe('interrupting a reply', () => {
  it('asks Rust to cancel, forgets the pending reply and ignores the late result', async () => {
    const gate = Deferred.makeUnsafe<void>();
    const script = aScript({ gate });
    const registry = opened(script);
    registry.mount(interruptReplyAtom);
    const sending = run(registry, script);
    await until(() => registry.get(sendPendingAtom));
    const generation = registry.get(generationAtom);
    registry.set(interruptReplyAtom, { record: false, retainPreRoll: false });
    await until(() => script.cancelled.length === 1);
    await until(() => !registry.get(sendPendingAtom));
    expect(registry.get(generationAtom)).toBeGreaterThan(generation);
    expect(registry.get(pendingReplyAtom)).toBeNull();
    Deferred.doneUnsafe(gate, Effect.void);
    await sending;
    expect(registry.get(outcomeRecordAtom).outcome.tag).toBe('idle');
    expect(registry.get(pendingReplyAtom)).toBeNull();
  });
});
