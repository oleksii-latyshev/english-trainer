import { expect, it } from 'bun:test';
import { Deferred, Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { Ipc, IpcError } from '@/core/ipc';
import { type PracticeState, practiceStateAtom } from '@/core/practice-session';
import { planningAtom } from '@/core/practice-turn';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { helpLevelAtom, helpNoticeAtom, planAtom, planningTimerAtom } from '../model/atoms';
import { answerHelpEffectsAtom, helpSurfaceAtom } from '../model/effects';
import { changeHelpLevel } from '../model/help-level';
import { retryPlan } from '../model/plan';
import { cancelPlanning, startPlanning } from '../model/planning';
import { runtime } from '../model/runtime';
import { AnswerHelpService } from '../services/answer-help-service';
import { anAnswerPlan, aSessionDetails } from './builders';

installFakeLocalStorage();
Reflect.set(globalThis, 'isTauri', true);

type Gate = Deferred.Deferred<void>;

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  planGate: Gate | null;
  usageGate: Gate | null;
  failUsage: boolean;
  failPlans: number;
};

function argOf(args: unknown, name: string): unknown {
  return Reflect.get(args ?? {}, name);
}

function answer(rust: FakeRust, command: string, args: unknown) {
  switch (command) {
    case 'prefetch_answer_plan':
      return Effect.gen(function* () {
        const gate = rust.planGate;
        if (gate) yield* Deferred.await(gate);
        if (rust.failPlans > 0) {
          rust.failPlans -= 1;
          return yield* new IpcError({ code: 'rate_limited', message: 'Help is busy.' });
        }
        return anAnswerPlan(`q${String(argOf(args, 'sequence'))}`);
      });
    case 'record_answer_help_used':
      return Effect.gen(function* () {
        if (rust.usageGate) yield* Deferred.await(rust.usageGate);
        if (rust.failUsage) {
          return yield* new IpcError({ code: 'database_error', message: 'Not saved.' });
        }
        return null;
      });
    default:
      return Effect.fail(new IpcError({ code: 'invalid_request', message: command }));
  }
}

function aFakeRust(): FakeRust {
  return { calls: [], planGate: null, usageGate: null, failUsage: false, failPlans: 0 };
}

function opened(rust: FakeRust = aFakeRust()) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) => {
      rust.calls.push({ command, args });
      return answer(rust, command, args);
    },
  });
  const layer = AnswerHelpService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
  registry.set(practiceStateAtom, { tag: 'active', ...aSessionDetails() });
  registry.mount(practiceStateAtom);
  registry.mount(answerHelpEffectsAtom);
  registry.mount(helpSurfaceAtom);
  registry.mount(helpLevelAtom);
  registry.mount(planAtom);
  registry.mount(helpNoticeAtom);
  return { registry, rust };
}

function nextQuestion(registry: AtomRegistry.AtomRegistry) {
  const state: PracticeState = {
    tag: 'active',
    ...aSessionDetails({ turnCount: 1, question: 'Why?' }),
  };
  registry.set(practiceStateAtom, state);
}

async function settle() {
  for (let turn = 0; turn < 8; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function commands(rust: FakeRust) {
  return rust.calls.map((call) => call.command);
}

it('prepares the plan for the open question without opening help or recording its use', async () => {
  const { registry, rust } = opened();
  await settle();

  const plan = registry.get(planAtom);
  expect(plan.tag === 'ready' && plan.plan.model_answer).toBe('q1 model answer.');
  expect(registry.get(helpLevelAtom)).toBeNull();
  expect(commands(rust)).toEqual(['prefetch_answer_plan']);
  expect(rust.calls[0]?.args).toEqual({
    session_id: 7,
    sequence: 1,
    question: 'How was your day?',
    retry: false,
  });
});

it('shows a level only after its use is recorded for this answer', async () => {
  const usageGate = Effect.runSync(Deferred.make<void>());
  const { registry, rust } = opened();
  rust.usageGate = usageGate;
  await settle();

  changeHelpLevel(registry, 'phrases');
  await settle();
  expect(registry.get(helpLevelAtom)).toBeNull();
  Effect.runSync(Deferred.succeed(usageGate, undefined));
  await settle();

  expect(registry.get(helpLevelAtom)).toBe('phrases');
  expect(rust.calls[1]).toEqual({
    command: 'record_answer_help_used',
    args: { sessionId: 7, sequence: 1 },
  });

  changeHelpLevel(registry, null);
  expect(registry.get(helpLevelAtom)).toBeNull();
});

it('keeps help closed and says so when its use could not be recorded', async () => {
  const { registry, rust } = opened();
  rust.failUsage = true;
  await settle();

  changeHelpLevel(registry, 'frame');
  await settle();

  expect(registry.get(helpLevelAtom)).toBeNull();
  expect(registry.get(helpNoticeAtom)).toContain('Help could not be marked');

  rust.failUsage = false;
  changeHelpLevel(registry, 'frame');
  await settle();
  expect(registry.get(helpLevelAtom)).toBe('frame');
  expect(registry.get(helpNoticeAtom)).toBeNull();
});

it('lets a late plan for the previous question go', async () => {
  const gate = Effect.runSync(Deferred.make<void>());
  const rust = aFakeRust();
  rust.planGate = gate;
  const { registry } = opened(rust);
  await settle();
  nextQuestion(registry);
  rust.planGate = null;
  await settle();
  Effect.runSync(Deferred.succeed(gate, undefined));
  await settle();

  const plan = registry.get(planAtom);
  expect(plan.tag === 'ready' && plan.plan.model_answer).toBe('q2 model answer.');
});

it('offers a retry after a failed plan and asks the backend to retry', async () => {
  const rust = aFakeRust();
  rust.failPlans = 1;
  const { registry } = opened(rust);
  await settle();
  expect(registry.get(planAtom).tag).toBe('failed');

  retryPlan(registry);
  await settle();

  expect(registry.get(planAtom).tag).toBe('ready');
  expect(rust.calls[rust.calls.length - 1]?.args).toMatchObject({ retry: true });
});

it('hides Example as soon as the answer starts being captured', async () => {
  const { registry } = opened();
  await settle();
  changeHelpLevel(registry, 'example');
  await settle();
  expect(registry.get(helpLevelAtom)).toBe('example');

  registry.set(captureStateAtom, { tag: 'requesting' });

  expect(registry.get(helpLevelAtom)).toBeNull();
});

it('never shows Example once capture touched the request', async () => {
  const { registry } = opened();
  await settle();
  registry.set(captureStateAtom, { tag: 'requesting' });

  changeHelpLevel(registry, 'example');
  await settle();
  expect(registry.get(helpLevelAtom)).toBeNull();

  registry.set(captureStateAtom, { tag: 'idle' });
  changeHelpLevel(registry, 'example');
  registry.set(captureStateAtom, { tag: 'requesting' });
  await settle();
  expect(registry.get(helpLevelAtom)).toBeNull();
});

it('plans only on the Frame, and stops planning when asked', async () => {
  const { registry } = opened();
  await settle();

  startPlanning(registry, 15);
  expect(registry.get(planningTimerAtom)).toBeNull();

  changeHelpLevel(registry, 'frame');
  await settle();
  startPlanning(registry, 15);
  expect(registry.get(planningTimerAtom)?.durationSeconds).toBe(15);
  expect(registry.get(planningAtom)).toBe(true);

  cancelPlanning(registry);
  expect(registry.get(planningTimerAtom)).toBeNull();
  expect(registry.get(planningAtom)).toBe(false);
});
