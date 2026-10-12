import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { isWaveAudio, WaveAudioSchema } from './index';

function wave(byteLength = 64): number[] {
  const bytes = new Array<number>(byteLength).fill(0);
  [...'RIFF'].forEach((letter, index) => {
    bytes[index] = letter.charCodeAt(0);
  });
  [...'WAVE'].forEach((letter, index) => {
    bytes[8 + index] = letter.charCodeAt(0);
  });
  return bytes;
}

describe('wave audio', () => {
  it('accepts a RIFF/WAVE buffer of a sane size', () => {
    expect(isWaveAudio(new Uint8Array(wave()).buffer)).toBe(true);
    expect(isWaveAudio(new Uint8Array(wave(43)).buffer)).toBe(false);
    expect(isWaveAudio(new Uint8Array(wave(5_292_045)).buffer)).toBe(false);
  });

  it('rejects a buffer that is not a wave file', () => {
    expect(isWaveAudio(new Uint8Array(64).buffer)).toBe(false);
  });

  it('decodes a buffer and a list of byte values into a buffer', () => {
    const decode = Schema.decodeUnknownSync(WaveAudioSchema);
    expect(decode(new Uint8Array(wave()).buffer).byteLength).toBe(64);
    expect(decode(wave()).byteLength).toBe(64);
  });

  it('refuses anything else', () => {
    const decode = Schema.decodeUnknownSync(WaveAudioSchema);
    expect(() => decode('RIFF')).toThrow();
    expect(() => decode([300, 1, 2])).toThrow();
    expect(() => decode(new Uint8Array(64).buffer)).toThrow();
  });
});
