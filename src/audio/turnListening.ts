import type { AudioFrame } from './microphoneSession';
import { createTurnDetector } from './turnDetector';

type FrameSource = {
  subscribeFrames: (listener: (frame: AudioFrame) => void) => () => void;
  noiseFloor: () => number;
};

export type TurnListening = {
  setHold: (held: boolean) => void;
  dispose: () => void;
};

export type TurnListeningOptions = {
  endPauseMs: number;
  /** Frames during this opening span are ignored, e.g. the tail of the assistant's own voice. */
  settleMs?: number;
};

/** Feeds a session's frames to a turn detector seeded with the session's measured noise floor. */
export function listenForTurn(
  source: FrameSource,
  options: TurnListeningOptions,
  handlers: { onSpeechStarted: () => void; onTurnEnded: () => void },
): TurnListening {
  const detector = createTurnDetector({
    endPauseMs: options.endPauseMs,
    initialNoiseFloor: source.noiseFloor(),
  });
  let settledMs = 0;
  const unsubscribe = source.subscribeFrames((frame) => {
    if (settledMs < (options.settleMs ?? 0)) {
      settledMs += frame.durationMs;
      return;
    }
    const result = detector.push(frame.rms, frame.durationMs);
    if (result.speechStarted) handlers.onSpeechStarted();
    if (result.turnEnded) handlers.onTurnEnded();
  });
  return { setHold: detector.setHold, dispose: unsubscribe };
}
