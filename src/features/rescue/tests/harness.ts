import { Deferred, Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import {
  type CaptureControl,
  captureControlAtom,
  captureRequestIdAtom,
  captureRuntime,
  captureStateAtom,
} from '@/core/answer-capture';
import { Ipc, IpcError } from '@/core/ipc';
import { practiceStateAtom } from '@/core/practice-session';
import { SpeechRecognition } from '@/core/speech';
import { rescueStateAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { RescueService } from '../services/rescue-service';
import { aListening, aSessionDetails } from './builders';

Reflect.set(globalThis, 'isTauri', true);

type Gate = Deferred.Deferred<void>;

export type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  rescueGate: Gate | null;
  failRescues: number;
  transcript: string;
  transcriptGate: Gate | null;
  transcriptFailure: IpcError | null;
};

export function aFakeRust(): FakeRust {
  return {
    calls: [],
    rescueGate: null,
    failRescues: 0,
    transcript: 'I use a notebook because',
    transcriptGate: null,
    transcriptFailure: null,
  };
}

function requestOf(args: unknown): { kind: string } {
  const request: unknown = Reflect.get(args ?? {}, 'request');
  return { kind: String(Reflect.get(request ?? {}, 'kind')) };
}

function answer(rust: FakeRust, args: unknown) {
  return Effect.gen(function* () {
    if (rust.rescueGate) yield* Deferred.await(rust.rescueGate);
    if (rust.failRescues > 0) {
      rust.failRescues -= 1;
      return yield* new IpcError({ code: 'unavailable', message: 'Rescue is busy.' });
    }
    const { kind } = requestOf(args);
    if (kind === 'missing_word') return { kind, candidates: ['cache', 'buffer', 'memory'] };
    return { kind, suggestion: `a ${kind} suggestion` };
  });
}

function fakeControl(): CaptureControl {
  return {
    stopped: Effect.runSync(Deferred.make<'stop' | 'cancel'>()),
    watchesTurns: false,
    capture: {
      level: Effect.succeed(0.2),
      snapshot: () => Effect.succeed(new Blob(['wav'])),
      window: () => Effect.succeed(null),
      stop: Effect.never,
    },
  };
}

export function recording(rust: FakeRust = aFakeRust()) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) => {
      rust.calls.push({ command, args });
      return command === 'rescue_answer'
        ? answer(rust, args)
        : Effect.fail(new IpcError({ code: 'invalid_request', message: command }));
    },
  });
  const recognition = Layer.succeed(SpeechRecognition, {
    transcribe: () => Effect.never,
    transcribePartial: () => Effect.succeed(null),
    transcribeRescue: () =>
      Effect.gen(function* () {
        if (rust.transcriptGate) yield* Deferred.await(rust.transcriptGate);
        if (rust.transcriptFailure) return yield* rust.transcriptFailure;
        return rust.transcript;
      }),
    engineStatus: Effect.never,
    warm: Effect.void,
  });
  const layer = RescueService.layer.pipe(Layer.provide(ipc), Layer.provideMerge(Reactivity.layer));
  const registry = AtomRegistry.make({
    initialValues: [
      [runtime.layer, layer],
      [captureRuntime.layer, recognition],
    ],
  });
  registry.set(practiceStateAtom, { tag: 'active', ...aSessionDetails() });
  registry.mount(practiceStateAtom);
  registry.set(captureRequestIdAtom, 3);
  registry.set(captureControlAtom, fakeControl());
  registry.set(captureStateAtom, { tag: 'recording', ...aListening() });
  registry.mount(rescueStateAtom);
  return { registry, rust };
}

export async function settle() {
  for (let turn = 0; turn < 12; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

export function rescueCalls(rust: FakeRust) {
  return rust.calls.filter((call) => call.command === 'rescue_answer');
}
