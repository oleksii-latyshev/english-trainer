import { Effect, Layer, Stream } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import type { RecordedAudio, TurnEvent } from '@/core/audio';
import { IpcError } from '@/core/ipc';
import { SpeechRecognition, type SpeechRecognitionFailure } from '@/core/speech';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { captureRuntime } from '../model/runtime';
import { AnswerRecorder } from '../services/answer-recorder-service';

installFakeLocalStorage();
Reflect.set(globalThis, 'isTauri', true);

const A_RECORDING: RecordedAudio = {
  wav: new Blob(['wav'], { type: 'audio/wav' }),
  durationMs: 1800,
  signal: { capturedMs: 1800, elapsedMs: 1800, windows: [] },
};

export type Microphone = {
  turns: TurnEvent[] | null;
  stopRequested: number;
  released: boolean;
  transcripts: Array<{ text: string; sttMs: number } | SpeechRecognitionFailure>;
  transcribed: number;
};

export function aMicrophone(overrides: Partial<Microphone> = {}): Microphone {
  return {
    turns: null,
    stopRequested: 0,
    released: false,
    transcripts: [{ text: 'I use a notebook.', sttMs: 140 }],
    transcribed: 0,
    ...overrides,
  };
}

function recorderLayer(microphone: Microphone) {
  return Layer.succeed(AnswerRecorder, {
    open: () =>
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            microphone.released = true;
          }),
        );
        return {
          input: { deviceId: 'fake', label: 'Fake microphone' },
          capture: {
            level: Effect.succeed(0.2),
            snapshot: () => Effect.succeed(null),
            window: () => Effect.succeed(null),
            stop: Effect.sync(() => {
              microphone.stopRequested += 1;
              return A_RECORDING;
            }),
          },
          lost: Effect.never,
          turns: microphone.turns
            ? () => Stream.fromIterable(microphone.turns ?? []).pipe(Stream.concat(Stream.never))
            : null,
        };
      }),
  });
}

function recognitionLayer(microphone: Microphone) {
  return Layer.succeed(SpeechRecognition, {
    transcribe: () =>
      Effect.suspend(() => {
        const next =
          microphone.transcripts[
            Math.min(microphone.transcribed, microphone.transcripts.length - 1)
          ];
        microphone.transcribed += 1;
        if (next instanceof IpcError) return Effect.fail(next);
        return Effect.succeed(next as { text: string; sttMs: number });
      }),
    transcribePartial: () => Effect.succeed(null),
    transcribeRescue: () => Effect.succeed(''),
    engineStatus: Effect.fail(new IpcError({ code: 'unavailable', message: 'no engine' })),
    warm: Effect.void,
  });
}

export function openCapture(microphone: Microphone) {
  return AtomRegistry.make({
    initialValues: [
      [
        captureRuntime.layer,
        Layer.mergeAll(recorderLayer(microphone), recognitionLayer(microphone)),
      ],
    ],
  });
}

export async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the capture never reached the expected state');
}
