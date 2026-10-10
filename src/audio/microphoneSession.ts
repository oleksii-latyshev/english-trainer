import { buildAudioConstraints } from './audioConstraints';
import {
  type AudioSignalSummary,
  measureAudioLevel,
  signalMeterValue,
  summarizeAudioSignal,
} from './audioSignal';
import { createCaptureStartup } from './captureStartup';
import { getPreferredDeviceId, recordActualAudioInput } from './devicePreference';
import { actualEchoCancellationEnabled, describeInput } from './microphoneInput';
import { encodeWav, resampleForWhisper } from './pcmEncoding';
import { createPreRollBuffer } from './preRollBuffer';
import { createNoiseFloorTracker } from './turnDetector';
import type { ActualAudioInput } from './types';

export type RecordedAudio = {
  wav: Blob;
  durationMs: number;
  signal: AudioSignalSummary;
};

export type AudioFrame = { samples: Float32Array; rms: number; durationMs: number };

export const MAX_PRE_ROLL_MS = 300;
export const MIC_NOT_READY_MESSAGE =
  'The microphone did not become ready. Reconnect it and try again.';
export const MIC_DISCONNECTED_MESSAGE =
  'The microphone disconnected before recording. Reconnect it and try again.';
const STARTUP_TIMEOUT_MS = 8000;

export type CaptureOptions = {
  /** Audio from just before the request to include, clamped to MAX_PRE_ROLL_MS. */
  preRollMs?: number;
  onDeviceLost?: () => void;
};

/** Past this much audio a partial transcript takes too long to stay live. */
export const MAX_SNAPSHOT_MS = 30_000;

export type MicrophoneCapture = {
  /** The audio captured so far as a WAV, while capturing goes on; null when there is none or too much. */
  snapshot: () => Promise<Blob | null>;
  stop: () => Promise<RecordedAudio>;
  cancel: () => void;
  level: () => number;
};

export type SessionHooks = {
  onWarm?: () => void;
  /** Called once when the session breaks (device lost, startup timeout, open failure). */
  onFailure?: (error: Error) => void;
};

export type MicrophoneSession = {
  /** Resolves with the input actually used once the stream is running; rejects if it cannot open. */
  opened: Promise<ActualAudioInput>;
  /** Resolves after the one-time input warm-up; rejects on timeout, device loss or close. */
  whenWarm: () => Promise<void>;
  isWarm: () => boolean;
  level: () => number;
  noiseFloor: () => number;
  /** True only when the live input track reports that echo cancellation is enabled. */
  echoCancellationEnabled: () => boolean;
  subscribeFrames: (listener: (frame: AudioFrame) => void) => () => void;
  /** Starts capturing immediately. Call after `opened` has resolved. */
  beginCapture: (options?: CaptureOptions) => MicrophoneCapture;
  close: () => Promise<void>;
};

export type MicrophoneSessionOptions = {
  deviceId?: string;
  echoCancellation?: boolean;
  hooks?: SessionHooks;
};

const workletSource = `
class MonoPcmProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const mono = new Float32Array(input[0].length);
      for (const channel of input) {
        for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / input.length;
      }
      this.port.postMessage(mono, [mono.buffer]);
    }
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
}
registerProcessor('mono-pcm-recorder', MonoPcmProcessor);
`;

type ActiveCapture = {
  chunks: Float32Array[];
  sampleCount: number;
  startedAtMs: number;
  preRollMs: number;
  onDeviceLost?: () => void;
};

/**
 * One open microphone stream. Frames keep flowing while it is open, the input is warmed up once,
 * and each capture starts instantly, optionally with a short pre-roll. Audio stays in memory only.
 */
export function createMicrophoneSession(options: MicrophoneSessionOptions = {}): MicrophoneSession {
  const hooks = options.hooks ?? {};
  const listeners = new Set<(frame: AudioFrame) => void>();
  const noise = createNoiseFloorTracker();
  let preRoll = createPreRollBuffer(0);
  let sampleRateHz = 0;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let sink: GainNode | undefined;
  let moduleUrl: string | undefined;
  let startup: ReturnType<typeof createCaptureStartup> | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let failed = false;
  let warm = false;
  let currentLevel = 0;
  let active: ActiveCapture | null = null;

  let resolveOpened: (input: ActualAudioInput) => void = () => {};
  let rejectOpened: (error: Error) => void = () => {};
  const opened = new Promise<ActualAudioInput>((resolve, reject) => {
    resolveOpened = resolve;
    rejectOpened = reject;
  });
  let resolveWarm: () => void = () => {};
  let rejectWarm: (error: Error) => void = () => {};
  const warmPromise = new Promise<void>((resolve, reject) => {
    resolveWarm = resolve;
    rejectWarm = reject;
  });
  // Failures reach callers through the hooks and the awaited promises; these keep the internal
  // copies from being reported as unhandled when nobody awaits them.
  opened.catch(() => {});
  warmPromise.catch(() => {});

  async function close() {
    if (closed) return;
    closed = true;
    clearTimeout(startupTimer);
    listeners.clear();
    active = null;
    preRoll.clear();
    const error = new Error(MIC_DISCONNECTED_MESSAGE);
    rejectOpened(error);
    rejectWarm(error);
    for (const track of stream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    node?.disconnect();
    source?.disconnect();
    sink?.disconnect();
    if (node) {
      node.port.onmessage = null;
      node.onprocessorerror = null;
    }
    if (context) await context.close();
    if (moduleUrl) URL.revokeObjectURL(moduleUrl);
  }

  function fail(error: Error) {
    if (closed || failed) return;
    failed = true;
    active?.onDeviceLost?.();
    rejectOpened(error);
    rejectWarm(error);
    hooks.onFailure?.(error);
    // The failure is already reported; a teardown error has no one left to tell.
    void close().catch(() => {});
  }

  function handleFrame(samples: Float32Array) {
    if (closed) return;
    const durationMs = (samples.length / sampleRateHz) * 1000;
    const rms = measureAudioLevel(samples).rms;
    currentLevel = signalMeterValue(rms);
    if (!warm) {
      if (startup?.accept(samples.length)) {
        warm = true;
        clearTimeout(startupTimer);
        resolveWarm();
        hooks.onWarm?.();
      }
    } else {
      noise.update(rms, durationMs);
    }
    preRoll.push(samples);
    if (active) {
      active.chunks.push(samples);
      active.sampleCount += samples.length;
    }
    const frame = { samples, rms, durationMs };
    for (const listener of [...listeners]) listener(frame);
  }

  async function open() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
      throw new Error('Microphone recording is unavailable in this app environment.');
    }
    const targetDeviceId =
      options.deviceId !== undefined ? options.deviceId : getPreferredDeviceId();
    const media = await navigator.mediaDevices.getUserMedia(
      buildAudioConstraints(targetDeviceId, options.echoCancellation ?? false),
    );
    stream = media;
    if (closed) {
      for (const track of media.getTracks()) track.stop();
      return;
    }
    const actualInput = describeInput(media);
    recordActualAudioInput(actualInput);
    const audioContext = new AudioContext();
    context = audioContext;
    sampleRateHz = audioContext.sampleRate;
    preRoll = createPreRollBuffer(Math.ceil((sampleRateHz * MAX_PRE_ROLL_MS) / 1000));
    startup = createCaptureStartup(sampleRateHz);
    moduleUrl = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }));
    await audioContext.audioWorklet.addModule(moduleUrl);
    if (closed) return;
    const inputNode = audioContext.createMediaStreamSource(media);
    const processor = new AudioWorkletNode(audioContext, 'mono-pcm-recorder');
    const silentSink = audioContext.createGain();
    silentSink.gain.value = 0;
    source = inputNode;
    node = processor;
    sink = silentSink;
    const lost = () => fail(new Error(MIC_DISCONNECTED_MESSAGE));
    processor.onprocessorerror = lost;
    for (const track of media.getAudioTracks()) track.onended = lost;
    processor.port.onmessage = (event: MessageEvent<Float32Array>) => handleFrame(event.data);
    startupTimer = setTimeout(() => fail(new Error(MIC_NOT_READY_MESSAGE)), STARTUP_TIMEOUT_MS);
    inputNode.connect(processor).connect(silentSink).connect(audioContext.destination);
    await audioContext.resume();
    resolveOpened(actualInput);
  }

  void open().catch((error: unknown) =>
    fail(error instanceof Error ? error : new Error('Recording failed. Please try again.')),
  );

  function beginCapture(captureOptions: CaptureOptions = {}): MicrophoneCapture {
    if (closed || failed || !context) throw new Error(MIC_DISCONNECTED_MESSAGE);
    const preRollMs = Math.max(0, Math.min(MAX_PRE_ROLL_MS, captureOptions.preRollMs ?? 0));
    const chunks = preRoll.snapshot(Math.floor((sampleRateHz * preRollMs) / 1000));
    const capture: ActiveCapture = {
      chunks,
      sampleCount: chunks.reduce((total, chunk) => total + chunk.length, 0),
      startedAtMs: performance.now(),
      preRollMs,
      onDeviceLost: captureOptions.onDeviceLost,
    };
    active = capture;
    const detach = () => {
      if (active === capture) active = null;
    };
    return {
      level: () => currentLevel,
      snapshot: async () => {
        if (active !== capture || capture.sampleCount === 0) return null;
        if ((capture.sampleCount / sampleRateHz) * 1000 > MAX_SNAPSHOT_MS) return null;
        // The chunks are only appended to, so a copy of the list is a consistent cut.
        const chunks = [...capture.chunks];
        const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
        const resampled = await resampleForWhisper(chunks, sampleCount, sampleRateHz);
        return encodeWav([resampled], resampled.length, 16_000);
      },
      cancel: () => {
        detach();
        capture.chunks = [];
        capture.sampleCount = 0;
      },
      stop: async () => {
        detach();
        const elapsedMs = performance.now() - capture.startedAtMs + capture.preRollMs;
        if (capture.sampleCount === 0)
          throw new Error('No microphone audio was captured. Please try again.');
        const rate = sampleRateHz;
        const resampled = await resampleForWhisper(capture.chunks, capture.sampleCount, rate);
        const signal = summarizeAudioSignal(capture.chunks, rate, elapsedMs);
        capture.chunks = [];
        return {
          wav: encodeWav([resampled], resampled.length, 16_000),
          durationMs: Math.round((resampled.length / 16_000) * 1000),
          signal,
        };
      },
    };
  }

  return {
    opened,
    whenWarm: () => warmPromise,
    isWarm: () => warm,
    level: () => currentLevel,
    noiseFloor: () => noise.value(),
    echoCancellationEnabled: () => {
      const track = stream?.getAudioTracks()[0];
      const settings = typeof track?.getSettings === 'function' ? track.getSettings() : undefined;
      return actualEchoCancellationEnabled(settings);
    },
    subscribeFrames(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    beginCapture,
    close,
  };
}
