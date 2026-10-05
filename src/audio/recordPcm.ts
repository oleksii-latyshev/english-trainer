import { buildAudioConstraints } from './audioConstraints';
import {
  type AudioSignalSummary,
  measureAudioLevel,
  signalMeterValue,
  summarizeAudioSignal,
} from './audioSignal';
import { createCaptureStartup } from './captureStartup';
import { getPreferredDeviceId, recordActualAudioInput } from './devicePreference';
import type { ActualAudioInput } from './types';

export type RecordedAudio = {
  wav: Blob;
  durationMs: number;
  signal: AudioSignalSummary;
};

export type PcmRecorder = {
  stop: () => Promise<RecordedAudio>;
  cancel: () => Promise<void>;
  actualInput: ActualAudioInput;
  level: () => number;
};

export type StartPcmRecordingOptions = {
  deviceId?: string;
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

function encodeWav(chunks: Float32Array[], sampleCount: number, sampleRateHz: number): Blob {
  const data = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(data);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, data.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}

async function resampleForWhisper(
  chunks: Float32Array[],
  sampleCount: number,
  sourceRateHz: number,
): Promise<Float32Array> {
  const targetRateHz = 16_000;
  const outputLength = Math.ceil((sampleCount * targetRateHz) / sourceRateHz);
  const offline = new OfflineAudioContext(1, outputLength, targetRateHz);
  const sourceBuffer = offline.createBuffer(1, sampleCount, sourceRateHz);
  const samples = sourceBuffer.getChannelData(0);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  const source = offline.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

export async function startPcmRecording(
  onDeviceLost: () => void,
  options?: StartPcmRecordingOptions,
): Promise<PcmRecorder> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    throw new Error('Microphone recording is unavailable in this app environment.');
  }

  const targetDeviceId =
    options?.deviceId !== undefined ? options.deviceId : getPreferredDeviceId();
  const constraints = buildAudioConstraints(targetDeviceId);

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const [track] = stream.getAudioTracks();
  const settings = typeof track?.getSettings === 'function' ? track.getSettings() : {};
  const actualInput: ActualAudioInput = {
    deviceId: typeof settings.deviceId === 'string' ? settings.deviceId : '',
    label: track?.label ? track.label : 'Microphone',
    echoCancellation:
      typeof settings.echoCancellation === 'boolean' ? settings.echoCancellation : undefined,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  };
  recordActualAudioInput(actualInput);

  let context: AudioContext | undefined;
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let sink: GainNode | undefined;
  let moduleUrl: string | undefined;
  let closed = false;
  let deviceLost = false;
  let rejectStartup: ((error: Error) => void) | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let recordingStartedAtMs = 0;
  let currentLevel = 0;
  const handleDeviceLost = () => {
    deviceLost = true;
    rejectStartup?.(
      new Error('The microphone disconnected before recording. Reconnect it and try again.'),
    );
    onDeviceLost();
  };
  const chunks: Float32Array[] = [];
  let sampleCount = 0;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(startupTimer);
    rejectStartup = undefined;
    for (const audioTrack of stream.getTracks()) {
      audioTrack.onended = null;
      audioTrack.stop();
    }
    node?.disconnect();
    source?.disconnect();
    sink?.disconnect();
    if (node) node.port.onmessage = null;
    if (context) await context.close();
    if (moduleUrl) URL.revokeObjectURL(moduleUrl);
  };

  try {
    context = new AudioContext();
    moduleUrl = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }));
    await context.audioWorklet.addModule(moduleUrl);
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, 'mono-pcm-recorder');
    sink = context.createGain();
    sink.gain.value = 0;
    const startup = createCaptureStartup(context.sampleRate);
    const activeContext = context;
    const activeNode = node;
    const activeSource = source;
    const activeSink = sink;
    node.onprocessorerror = handleDeviceLost;
    for (const audioTrack of stream.getAudioTracks()) audioTrack.onended = handleDeviceLost;
    await new Promise<void>((resolve, reject) => {
      rejectStartup = reject;
      startupTimer = setTimeout(() => {
        reject(new Error('The microphone did not become ready. Reconnect it and try again.'));
      }, 8000);
      activeNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!recordingStartedAtMs) {
          if (!startup.accept(event.data.length)) return;
          recordingStartedAtMs = performance.now();
          clearTimeout(startupTimer);
          rejectStartup = undefined;
          resolve();
          return;
        }
        chunks.push(event.data);
        sampleCount += event.data.length;
        currentLevel = signalMeterValue(measureAudioLevel(event.data).rms);
      };
      activeSource.connect(activeNode).connect(activeSink).connect(activeContext.destination);
      void activeContext.resume().catch(reject);
    });
    if (deviceLost || track?.readyState === 'ended')
      throw new Error('The microphone disconnected before recording. Reconnect it and try again.');
    const sampleRateHz = context.sampleRate;

    return {
      stop: async () => {
        const elapsedMs = performance.now() - recordingStartedAtMs;
        await cleanup();
        if (sampleCount === 0)
          throw new Error('No microphone audio was captured. Please try again.');
        const resampled = await resampleForWhisper(chunks, sampleCount, sampleRateHz);
        return {
          wav: encodeWav([resampled], resampled.length, 16_000),
          durationMs: Math.round((resampled.length / 16_000) * 1000),
          signal: summarizeAudioSignal(chunks, sampleRateHz, elapsedMs),
        };
      },
      cancel: cleanup,
      actualInput,
      level: () => currentLevel,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
