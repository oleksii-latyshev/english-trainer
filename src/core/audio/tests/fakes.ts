import { Effect, type Stream } from 'effect';
import type { AudioFrame } from '../audio';

export const SAMPLE_RATE_HZ = 1000;

export function identityResample(chunks: Float32Array[], sampleCount: number) {
  const joined = new Float32Array(sampleCount);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return Effect.succeed(joined);
}

export function tone(sampleCount: number, amplitude = 0.5): Float32Array {
  return new Float32Array(sampleCount).fill(amplitude);
}

export function frameOf(rms: number, durationMs: number): AudioFrame {
  return { samples: new Float32Array(0), rms, durationMs };
}

export type FrameSource = {
  readonly frames: Stream.Stream<AudioFrame>;
  readonly noiseFloor: Effect.Effect<number>;
};
