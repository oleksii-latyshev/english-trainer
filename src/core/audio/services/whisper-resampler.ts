import { Effect } from 'effect';
import { WHISPER_SAMPLE_RATE_HZ } from '../audio';
import { type MicrophoneError, microphoneFailureOf } from '../errors';

export type Resample = (
  chunks: Float32Array[],
  sampleCount: number,
  sourceRateHz: number,
) => Effect.Effect<Float32Array, MicrophoneError>;

async function render(
  chunks: Float32Array[],
  sampleCount: number,
  sourceRateHz: number,
): Promise<Float32Array> {
  const outputLength = Math.ceil((sampleCount * WHISPER_SAMPLE_RATE_HZ) / sourceRateHz);
  const offline = new OfflineAudioContext(1, outputLength, WHISPER_SAMPLE_RATE_HZ);
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

export function resampleForWhisper(
  chunks: Float32Array[],
  sampleCount: number,
  sourceRateHz: number,
): ReturnType<Resample> {
  return Effect.tryPromise({
    try: () => render(chunks, sampleCount, sourceRateHz),
    catch: microphoneFailureOf,
  });
}
