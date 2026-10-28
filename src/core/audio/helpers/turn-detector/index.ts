const MIN_NOISE_FLOOR = 0.001;
const SPEECH_RATIO = 3;
const MIN_SPEECH_RMS = 0.006;
const KEEP_RATIO = 2;
const MIN_KEEP_RMS = 0.004;
const FALL_TAU_MS = 300;
const RISE_TAU_MS = 20_000;
const NEAR_FLOOR_RISE_TAU_MS = 1500;
const BURST_RESET_SILENCE_MS = 250;

export type NoiseFloorTracker = {
  update: (rms: number, durationMs: number) => void;
  lowerTo: (floor: number) => void;
  value: () => number;
  threshold: () => number;
  keepThreshold: () => number;
};

export function createNoiseFloorTracker(initial = MIN_NOISE_FLOOR): NoiseFloorTracker {
  let floor = Math.max(MIN_NOISE_FLOOR, initial);
  function value() {
    return floor;
  }
  function tauFor(rms: number): number {
    if (rms < floor) return FALL_TAU_MS;
    return rms < floor * SPEECH_RATIO ? NEAR_FLOOR_RISE_TAU_MS : RISE_TAU_MS;
  }
  return {
    update(rms, durationMs) {
      if (!Number.isFinite(rms) || rms < 0 || durationMs <= 0) return;
      const tau = tauFor(rms);
      floor = Math.max(MIN_NOISE_FLOOR, floor + (rms - floor) * (1 - Math.exp(-durationMs / tau)));
    },
    lowerTo(next) {
      floor = Math.max(MIN_NOISE_FLOOR, Math.min(floor, next));
    },
    value,
    threshold: () => Math.max(MIN_SPEECH_RMS, floor * SPEECH_RATIO),
    keepThreshold: () => Math.max(MIN_KEEP_RMS, floor * KEEP_RATIO),
  };
}

export type TurnDetectorOptions = {
  endPauseMs: number;
  minSpeechMs?: number;
  initialNoiseFloor?: number;
};

export type TurnFrameResult = {
  speechStarted: boolean;
  turnEnded: boolean;
};

export type TurnDetector = {
  push: (rms: number, durationMs: number) => TurnFrameResult;
  setHold: (held: boolean) => void;
  setExtraPauseMs: (extraPauseMs: number) => void;
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
  let extraPauseMs = 0;
  let floorBeforeBurst = noise.value();

  function onSpeechFrame(durationMs: number): boolean {
    burstMs += durationMs;
    silenceMs = 0;
    if (confirmed || burstMs < minSpeechMs) return false;
    noise.lowerTo(floorBeforeBurst);
    confirmed = true;
    return true;
  }

  function onSilentFrame(durationMs: number): boolean {
    silenceMs += durationMs;
    if (!confirmed) {
      if (silenceMs >= BURST_RESET_SILENCE_MS) burstMs = 0;
      return false;
    }
    ended = !held && silenceMs >= options.endPauseMs + extraPauseMs;
    return ended;
  }

  function learnFloor(rms: number, isSpeech: boolean, durationMs: number) {
    if (isSpeech && burstMs === 0) floorBeforeBurst = noise.value();
    if (!confirmed || rms < noise.value()) noise.update(rms, durationMs);
  }

  return {
    push(rms, durationMs) {
      if (ended || !Number.isFinite(rms) || durationMs <= 0) {
        return { speechStarted: false, turnEnded: false };
      }
      const isSpeech = rms > (confirmed ? noise.keepThreshold() : noise.threshold());
      learnFloor(rms, isSpeech, durationMs);
      if (isSpeech) return { speechStarted: onSpeechFrame(durationMs), turnEnded: false };
      return { speechStarted: false, turnEnded: onSilentFrame(durationMs) };
    },
    setHold(next) {
      if (held && !next) silenceMs = 0;
      held = next;
    },
    setExtraPauseMs(next) {
      extraPauseMs = Math.max(0, next);
    },
    hasSpeech: () => confirmed,
  };
}
