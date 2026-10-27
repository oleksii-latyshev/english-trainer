import { type Duration, Effect, Layer } from 'effect';
import { Ipc, IpcBinary, type IpcError } from '@/core/ipc';

type BinaryCall = {
  readonly command: string;
  readonly bytes: Uint8Array;
  readonly headers: Readonly<Record<string, string>> | undefined;
};

export type FakeRust = {
  readonly status?: unknown;
  readonly binaryResults?: Readonly<Record<string, unknown>>;
  readonly failBinaryWith?: IpcError;
  readonly binaryDelay?: Duration.Input;
};

export function fakeRecognitionRust(rust: FakeRust = {}) {
  const binaryCalls: BinaryCall[] = [];
  const calls: string[] = [];
  const layer = Layer.mergeAll(
    Layer.succeed(Ipc, {
      invoke: (command) => {
        calls.push(command);
        if (command === 'get_speech_engine_status') {
          return Effect.succeed(
            rust.status ?? {
              server: 'ready',
              failure: null,
              is_live_transcript_available: true,
            },
          );
        }
        return Effect.succeed(null);
      },
    }),
    Layer.succeed(IpcBinary, {
      invoke: (command, bytes, headers) => {
        binaryCalls.push({ command, bytes, headers });
        if (rust.failBinaryWith) return Effect.fail(rust.failBinaryWith);
        const result = Effect.succeed(rust.binaryResults?.[command] ?? null);
        return rust.binaryDelay === undefined ? result : Effect.delay(result, rust.binaryDelay);
      },
    }),
  );
  return { layer, binaryCalls, calls };
}

export function wavOf(text: string): Blob {
  return new Blob([text]);
}
