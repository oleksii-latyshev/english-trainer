import {
  createMicrophoneSession,
  type MicrophoneCapture,
  type RecordedAudio,
} from './microphoneSession';
import type { ActualAudioInput } from './types';

export type { RecordedAudio };

export type PcmRecorder = {
  stop: () => Promise<RecordedAudio>;
  cancel: () => Promise<void>;
  actualInput: ActualAudioInput;
  level: () => number;
};

export type StartPcmRecordingOptions = {
  deviceId?: string;
};

/**
 * One-shot recording on its own microphone session: open, wait for the warm-up, capture, and
 * release the device on stop or cancel. The Settings test and the recall drill use this path;
 * practice conversations use a long-lived session instead.
 */
export async function startPcmRecording(
  onDeviceLost: () => void,
  options?: StartPcmRecordingOptions,
): Promise<PcmRecorder> {
  let capture: MicrophoneCapture | null = null;
  const session = createMicrophoneSession({
    deviceId: options?.deviceId,
    hooks: {
      onFailure: () => {
        if (capture) onDeviceLost();
      },
    },
  });
  try {
    const actualInput = await session.opened;
    await session.whenWarm();
    const active = session.beginCapture({ preRollMs: 0 });
    capture = active;
    return {
      actualInput,
      level: active.level,
      stop: async () => {
        try {
          return await active.stop();
        } finally {
          await session.close();
        }
      },
      cancel: async () => {
        active.cancel();
        await session.close();
      },
    };
  } catch (error) {
    await session.close();
    throw error;
  }
}
