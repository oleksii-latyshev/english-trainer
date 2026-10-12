import { Effect, Exit, Scope } from 'effect';
import {
  type ActualAudioInput,
  audioRuntime,
  type Capture,
  Microphone,
  type RecordedAudio,
  readPreferredMicrophone,
} from '@/core/audio';
import { settle, settleSync } from './settle';

export type PcmRecorder = {
  readonly snapshot: (options?: { tailMs: number }) => Promise<Blob | null>;
  readonly stop: () => Promise<RecordedAudio>;
  readonly cancel: () => Promise<void>;
  readonly actualInput: ActualAudioInput;
  readonly level: () => number;
  readonly capture: Capture;
};

export type StartPcmRecordingOptions = {
  readonly deviceId?: string;
};

export async function startPcmRecording(
  onDeviceLost: () => void,
  options?: StartPcmRecordingOptions,
): Promise<PcmRecorder> {
  const scope = audioRuntime.runSync(Scope.make());
  function release() {
    return settle(Scope.close(scope, Exit.void));
  }
  const deviceId = options?.deviceId ?? readPreferredMicrophone();
  const open = Effect.gen(function* () {
    const microphone = yield* Microphone;
    const session = yield* microphone.open({ deviceId });
    yield* session.warmed;
    const capture = yield* session.capture({ preRollMs: 0 });
    yield* Effect.forkScoped(
      session.lost.pipe(
        Effect.catch(() => Effect.sync(onDeviceLost)),
        Effect.ignore,
      ),
    );
    return { input: session.input, capture };
  }).pipe(Scope.provide(scope));
  try {
    const { input, capture } = await settle(open);
    return {
      actualInput: input,
      capture,
      level: () => settleSync(capture.level),
      snapshot: (snapshotOptions) => settle(capture.snapshot(snapshotOptions)),
      stop: async () => {
        try {
          return await settle(capture.stop);
        } finally {
          await release();
        }
      },
      cancel: release,
    };
  } catch (error) {
    await release();
    throw error;
  }
}
