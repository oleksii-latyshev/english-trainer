import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Exit, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { IpcError } from '@/core/ipc';
import { type PracticeState, practiceStateAtom } from '@/core/practice-session';
import { aSessionDetails } from '@/core/practice-session/tests/builders';
import { JOIN_WINDOW_MS } from '../helpers/join-window';
import { closeJoinWindow, currentJoinWindow, withContinuation } from '../model/continuation';
import { interruptReplyAtom } from '../model/interrupt';
import { turnRuntime } from '../model/runtime';
import { sendTurn } from '../model/send';
import {
  committedTurnAtom,
  continuationAtom,
  joinWindowAtom,
  pendingReplyAtom,
  sendPendingAtom,
} from '../model/state';
import { PracticeTurns } from '../services/practice-turn-service';
import type { JoinWindow, SendInput } from '../types';

const TURN = {
  spoken_reply: 'Where?',
  question: 'Which park?',
  session_phase: 'practice',
  is_complete: false,
};

type Script = {
  sent: Array<{ transcript: string; continuesTurn: number | undefined }>;
  cancelled: number[];
  gate: Deferred.Deferred<void> | null;
};

function fakeTurns(script: Script) {
  return Layer.succeed(PracticeTurns, {
    send: (request) =>
      Effect.gen(function* () {
        script.sent.push({
          transcript: request.transcript,
          continuesTurn: request.continuesTurn,
        });
        if (script.gate) yield* Deferred.await(script.gate);
        return TURN;
      }),
    cancel: (sessionId) => Effect.sync(() => script.cancelled.push(sessionId) > 0),
  });
}

function aScript(overrides: Partial<Script> = {}): Script {
  return { sent: [], cancelled: [], gate: null, ...overrides };
}

function voiceSession(turnCount = 0): PracticeState {
  return {
    tag: 'active',
    ...aSessionDetails({ practiceMode: 'voice', turnCount, spokenTurnCount: turnCount }),
  };
}

function opened(script: Script, state: PracticeState = voiceSession()) {
  const registry = AtomRegistry.make({ initialValues: [[turnRuntime.layer, fakeTurns(script)]] });
  registry.mount(practiceStateAtom);
  registry.mount(pendingReplyAtom);
  registry.set(practiceStateAtom, state);
  return registry;
}

function run(registry: AtomRegistry.AtomRegistry, script: Script, input: SendInput) {
  return Effect.runPromiseExit(sendTurn(registry, input).pipe(Effect.provide(fakeTurns(script))));
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the turn never reached the expected state');
}

function aWindow(overrides: Partial<JoinWindow> = {}): JoinWindow {
  return {
    sessionId: 7,
    sequence: 1,
    transcript: 'I went to',
    recordingMs: 1200,
    openedAtMs: performance.now(),
    ...overrides,
  };
}

const automatic: SendInput = {
  text: 'I went to',
  source: 'voice',
  recordingMs: 1200,
  endedByPause: true,
};

describe('opening the join window', () => {
  it('opens after an automatic end in a spoken conversation', async () => {
    const script = aScript();
    const registry = opened(script);
    await run(registry, script, automatic);
    expect(registry.get(joinWindowAtom)).toMatchObject({
      sessionId: 7,
      sequence: 1,
      transcript: 'I went to',
      recordingMs: 1200,
    });
  });

  it('stays closed for a manual send', async () => {
    const script = aScript();
    const registry = opened(script);
    await run(registry, script, { ...automatic, endedByPause: false });
    expect(registry.get(joinWindowAtom)).toBeNull();
  });

  it('stays closed for typed text', async () => {
    const script = aScript();
    const registry = opened(script);
    await run(registry, script, { ...automatic, source: 'text' });
    expect(registry.get(joinWindowAtom)).toBeNull();
  });

  it('closes when the reply fails', async () => {
    const script = aScript();
    const registry = opened(script);
    const failing = Layer.succeed(PracticeTurns, {
      send: () =>
        Effect.fail(new IpcError({ code: 'timeout', message: 'The model took too long.' })),
      cancel: () => Effect.succeed(false),
    });
    const exit = await Effect.runPromiseExit(
      sendTurn(registry, automatic).pipe(Effect.provide(failing)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(registry.get(joinWindowAtom)).toBeNull();
  });
});

describe('the join window lifetime', () => {
  it('is open inside the cap', () => {
    const registry = opened(aScript());
    registry.set(joinWindowAtom, aWindow());
    expect(currentJoinWindow(registry)).not.toBeNull();
  });

  it('is closed after the cap and forgotten', () => {
    const registry = opened(aScript());
    registry.set(joinWindowAtom, aWindow({ openedAtMs: performance.now() - JOIN_WINDOW_MS - 1 }));
    expect(currentJoinWindow(registry)).toBeNull();
    expect(registry.get(joinWindowAtom)).toBeNull();
  });

  it('is closed once Eva’s first audio starts', () => {
    const registry = opened(aScript());
    registry.set(joinWindowAtom, aWindow());
    closeJoinWindow(registry);
    expect(currentJoinWindow(registry)).toBeNull();
  });

  it('belongs to its session', () => {
    const registry = opened(aScript());
    registry.set(joinWindowAtom, aWindow({ sessionId: 99 }));
    expect(currentJoinWindow(registry)).toBeNull();
  });
});

describe('joining speech that continues an answer', () => {
  it('cancels the in-flight reply, forgets it and keeps the answer to continue', async () => {
    const gate = Deferred.makeUnsafe<void>();
    const script = aScript({ gate });
    const registry = opened(script);
    registry.mount(interruptReplyAtom);
    const sending = run(registry, script, automatic);
    await until(() => registry.get(sendPendingAtom));
    const window = currentJoinWindow(registry);
    expect(window).not.toBeNull();
    const { openedAtMs: _openedAtMs, ...continues } = window as JoinWindow;
    registry.set(interruptReplyAtom, { record: true, retainPreRoll: true, continues });
    await until(() => script.cancelled.length === 1);
    await until(() => registry.get(continuationAtom) !== null || !registry.get(sendPendingAtom));
    expect(registry.get(pendingReplyAtom)).toBeNull();
    expect(registry.get(joinWindowAtom)).toBeNull();
    Deferred.doneUnsafe(gate, Effect.void);
    await sending;
  });

  it('sends the previous answer and the continuation as one answer', () => {
    const registry = opened(aScript());
    registry.set(continuationAtom, {
      sessionId: 7,
      sequence: 1,
      transcript: 'I went to',
      recordingMs: 1200,
    });
    const joined = withContinuation(registry, {
      text: 'the park.',
      source: 'voice',
      recordingMs: 800,
    });
    expect(joined).toMatchObject({
      text: 'I went to the park.',
      recordingMs: 2000,
      continuesTurn: 1,
    });
  });

  it('does not join typed text', () => {
    const registry = opened(aScript());
    registry.set(continuationAtom, {
      sessionId: 7,
      sequence: 1,
      transcript: 'I went to',
      recordingMs: 1200,
    });
    const input: SendInput = { text: 'Typed.', source: 'text', recordingMs: 0 };
    expect(withContinuation(registry, input)).toEqual(input);
  });

  it('sends the joined text as a new turn when the cut-off reply never committed', async () => {
    const script = aScript();
    const registry = opened(script);
    const exit = await run(registry, script, {
      text: 'I went to the park.',
      source: 'voice',
      recordingMs: 2000,
      continuesTurn: 1,
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(script.sent).toEqual([{ transcript: 'I went to the park.', continuesTurn: 1 }]);
    expect(registry.get(practiceStateAtom)).toMatchObject({ turnCount: 1 });
  });

  it('does not count the answer twice when the cut-off reply had already committed', async () => {
    const script = aScript();
    const registry = opened(script, voiceSession(1));
    registry.set(committedTurnAtom, { sessionId: 7, sequence: 1 });
    await run(registry, script, {
      text: 'I went to the park.',
      source: 'voice',
      recordingMs: 2000,
      continuesTurn: 1,
    });
    expect(registry.get(practiceStateAtom)).toMatchObject({
      turnCount: 1,
      question: 'Which park?',
    });
    expect(registry.get(pendingReplyAtom)).toMatchObject({ savedTurnCount: 1 });
  });
});
