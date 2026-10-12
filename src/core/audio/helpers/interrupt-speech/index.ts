import { createTurnDetector } from '../turn-detector';

export type InterruptSpeechFrame = { rms: number; durationMs: number };

export function createInterruptSpeechDetector(options: {
  isEnabled: boolean;
  noiseFloor: number;
  onSpeechStarted: () => void;
}) {
  const detector = createTurnDetector({
    endPauseMs: Number.MAX_SAFE_INTEGER,
    minSpeechMs: 300,
    initialNoiseFloor: options.noiseFloor,
  });
  return {
    push(frame: InterruptSpeechFrame) {
      if (!options.isEnabled) return;
      if (detector.push(frame.rms, frame.durationMs).speechStarted) options.onSpeechStarted();
    },
  };
}
