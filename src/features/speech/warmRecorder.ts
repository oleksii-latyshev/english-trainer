import type { MicrophoneSession } from '@/audio/microphoneSession';
import type { PcmRecorder } from '@/audio/recordPcm';

/** Starts capturing on an already open microphone session; the session stays open afterwards. */
export async function startWarmRecording(
  session: MicrophoneSession,
  options: { preRollMs: number; onDeviceLost: () => void },
): Promise<PcmRecorder> {
  const actualInput = await session.opened;
  const capture = session.beginCapture({
    preRollMs: options.preRollMs,
    onDeviceLost: options.onDeviceLost,
  });
  return {
    actualInput,
    level: capture.level,
    snapshot: capture.snapshot,
    stop: capture.stop,
    cancel: async () => capture.cancel(),
  };
}
