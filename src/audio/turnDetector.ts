/** Energy-based end-of-turn detection with an adaptive noise floor. Pure: callers feed frame energy. */

const MIN_NOISE_FLOOR = 0.001;
const SPEECH_RATIO = 3;
const MIN_SPEECH_RMS = 0.006;
const FALL_TAU_MS = 300;
const RISE_TAU_MS = 20_000;
const NEAR_FLOOR_RISE_TAU_MS = 1500;
const BURST_RESET_SILENCE_MS = 250;

export type NoiseFloorTracker = {
  update: (rms: number, durationMs: number) => void;
  value: () => number;
  /** The rms a frame must exceed to count as speech. */
  threshold: () => number;
};

/**
 * Falls quickly to quiet frames and rises slowly, faster only for frames close to the floor, so
 * a few seconds of speech do not lift the floor above the speaker's own voice.
 */
export function createNoiseFloorTracker(initial = MIN_NOISE_FLOOR): NoiseFloorTracker {
  let floor = Math.max(MIN_NOISE_FLOOR, initial);
  const value = () => floor;
  return {
    update(rms, durationMs) {
      if (!Number.isFinite(rms) || rms < 0 || durationMs <= 0) return;
      const tau =
        rms < floor
          ? FALL_TAU_MS
          : rms < floor * SPEECH_RATIO
            ? NEAR_FLOOR_RISE_TAU_MS
            : RISE_TAU_MS;
      floor = Math.max(MIN_NOISE_FLOOR, floor + (rms - floor) * (1 - Math.exp(-durationMs / tau)));
    },
    value,
    threshold: () => Math.max(MIN_SPEECH_RMS, floor * SPEECH_RATIO),
  };
}

export type TurnDetectorOptions = {
  endPauseMs: number;
  minSpeechMs?: number;
  initialNoiseFloor?: number;
};

export type TurnFrameResult = {
  /** True once, on the frame where enough speech has accumulated to count as a turn. */
  speechStarted: boolean;
  /** True once, when the pause after speech reached `endPauseMs` and the turn is not held. */
  turnEnded: boolean;
};

export type TurnDetector = {
  push: (rms: number, durationMs: number) => TurnFrameResult;
  /** While held, the turn never ends; releasing restarts the silence timer. */
  setHold: (held: boolean) => void;
  hasSpeech: () => boolean;
};

export function createTurnDetector(options: TurnDetectorOptions): TurnDetector {
  const minSpeechMs = options.minSpeechMs ?? 300;
  const noise = createNoiseFloorTracker(options.initialNoiseFloor);
  let burstMs = 0;
  let silenceMs = 0;
  let confirmed = false;
  let ended = false;
  let held = false;

  function onSpeechFrame(durationMs: number): boolean {
    burstMs += durationMs;
    silenceMs = 0;
    if (confirmed || burstMs < minSpeechMs) return false;
    confirmed = true;
    return true;
  }

  function onSilentFrame(durationMs: number): boolean {
    silenceMs += durationMs;
    if (!confirmed) {
      if (silenceMs >= BURST_RESET_SILENCE_MS) burstMs = 0;
      return false;
    }
    ended = !held && silenceMs >= options.endPauseMs;
    return ended;
  }

  return {
    push(rms, durationMs) {
      if (ended || !Number.isFinite(rms) || durationMs <= 0) {
        return { speechStarted: false, turnEnded: false };
      }
      const isSpeech = rms > noise.threshold();
      if (!(isSpeech && confirmed)) noise.update(rms, durationMs);
      if (isSpeech) return { speechStarted: onSpeechFrame(durationMs), turnEnded: false };
      return { speechStarted: false, turnEnded: onSilentFrame(durationMs) };
    },
    setHold(next) {
      if (held && !next) silenceMs = 0;
      held = next;
    },
    hasSpeech: () => confirmed,
  };
}
