import type { PcmRecorder, WarmSession } from '@/app/microphone';

export async function startWarmRecording(
  session: WarmSession,
  options: { preRollMs: number; onDeviceLost: () => void },
): Promise<PcmRecorder> {
  const actualInput = await session.opened;
  const capture = session.beginCapture({
    preRollMs: options.preRollMs,
    onDeviceLost: options.onDeviceLost,
  });
  return {
    actualInput,
    capture: capture.capture,
    level: capture.level,
    snapshot: capture.snapshot,
    stop: capture.stop,
    cancel: async () => capture.cancel(),
  };
}
