export type RecordedAudio = {
  wav: Blob;
  durationMs: number;
};

export type PcmRecorder = {
  stop: () => Promise<RecordedAudio>;
  cancel: () => Promise<void>;
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

export async function startPcmRecording(onDeviceLost: () => void): Promise<PcmRecorder> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    throw new Error('Microphone recording is unavailable in this app environment.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true },
  });
  let context: AudioContext | undefined;
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let sink: GainNode | undefined;
  let moduleUrl: string | undefined;
  let closed = false;
  const chunks: Float32Array[] = [];
  let sampleCount = 0;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    for (const track of stream.getTracks()) {
      track.onended = null;
      track.stop();
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
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      chunks.push(event.data);
      sampleCount += event.data.length;
    };
    node.onprocessorerror = onDeviceLost;
    source.connect(node).connect(sink).connect(context.destination);
    for (const track of stream.getAudioTracks()) track.onended = onDeviceLost;
    await context.resume();
    const sampleRateHz = context.sampleRate;

    return {
      stop: async () => {
        await cleanup();
        if (sampleCount === 0)
          throw new Error('No microphone audio was captured. Please try again.');
        return {
          wav: encodeWav(chunks, sampleCount, sampleRateHz),
          durationMs: Math.round((sampleCount / sampleRateHz) * 1000),
        };
      },
      cancel: cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
