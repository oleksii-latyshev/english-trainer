import { Schema, SchemaGetter } from 'effect';

const MIN_WAVE_BYTES = 44;
const MAX_WAVE_BYTES = 5_292_044;
const HEADER_BYTES = 12;

function tag(bytes: Uint8Array, start: number) {
  return String.fromCharCode(...bytes.subarray(start, start + 4));
}

export function isWaveAudio(audio: ArrayBuffer): boolean {
  if (audio.byteLength < MIN_WAVE_BYTES || audio.byteLength > MAX_WAVE_BYTES) return false;
  const header = new Uint8Array(audio, 0, HEADER_BYTES);
  return tag(header, 0) === 'RIFF' && tag(header, 8) === 'WAVE';
}

const WaveBuffer = Schema.declare(
  (value): value is ArrayBuffer => value instanceof ArrayBuffer && isWaveAudio(value),
);

const WaveBytes = Schema.Array(
  Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 })),
).pipe(
  Schema.decodeTo(WaveBuffer, {
    decode: SchemaGetter.transform((bytes: readonly number[]) => new Uint8Array(bytes).buffer),
    encode: SchemaGetter.transform((audio: ArrayBuffer) => Array.from(new Uint8Array(audio))),
  }),
);

export const WaveAudioSchema = Schema.Union([WaveBuffer, WaveBytes]);
