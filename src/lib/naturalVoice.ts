import { invoke, isTauri } from '@tauri-apps/api/core';
import { isRecord } from './localPreference';

/** Mirrors Rust voice::VoiceError; recoverable errors trigger system speech. */
export type NaturalVoiceError = {
  code: 'unavailable' | 'busy' | 'invalid_input' | 'timeout' | 'process_failed';
  message: string;
};
export function isNaturalVoiceError(value: unknown): value is NaturalVoiceError {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    ['unavailable', 'busy', 'invalid_input', 'timeout', 'process_failed'].some(
      (code) => code === value.code,
    )
  );
}

export async function prewarmNaturalVoice(): Promise<boolean> {
  if (!isTauri()) return false;
  const result: unknown = await invoke('prewarm_natural_voice');
  if (typeof result !== 'boolean') throw new Error('Invalid local voice availability.');
  return result;
}

export async function synthesizeNaturalVoice(text: string, voice_id: number, speed: number) {
  const result: unknown = await invoke('synthesize_natural_voice', { text, voice_id, speed });
  // Tauri raw responses use ArrayBuffer; typed browser fixtures can also supply byte arrays.
  let bytes: ArrayBuffer;
  if (result instanceof ArrayBuffer) bytes = result;
  else if (
    Array.isArray(result) &&
    result.every(
      (byte) => typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255,
    )
  )
    bytes = new Uint8Array(result).buffer;
  else throw new Error('Invalid local voice audio.');
  if (bytes.byteLength < 44 || bytes.byteLength > 5_292_044)
    throw new Error('Invalid local voice audio size.');
  const header = new Uint8Array(bytes, 0, 12);
  if (
    String.fromCharCode(...header.subarray(0, 4)) !== 'RIFF' ||
    String.fromCharCode(...header.subarray(8, 12)) !== 'WAVE'
  ) {
    throw new Error('Invalid local voice audio format.');
  }
  return bytes;
}
