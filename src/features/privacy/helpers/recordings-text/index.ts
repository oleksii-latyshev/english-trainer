import type { KeptRecordings } from '../../types';

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTES_PER_GIGABYTE = 1024;

export function formatRecordingsSize(bytes: number): string {
  const megabytes = bytes / BYTES_PER_MEGABYTE;
  if (megabytes >= 1000) return `${(megabytes / MEGABYTES_PER_GIGABYTE).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(megabytes))} MB`;
}

export function keptRecordingsText(kept: KeptRecordings): string {
  if (kept.count === 0) return 'No recordings are kept.';
  const noun = kept.count === 1 ? 'recording' : 'recordings';
  return `${kept.count} ${noun} kept, ${formatRecordingsSize(kept.size_bytes)}, in the recordings folder of the app data.`;
}

export function keepRawAudioText(keepsAudio: boolean): string {
  return keepsAudio
    ? 'On: each answer is kept on this Mac as a recording, after transcription, until you delete it. Nothing is uploaded.'
    : 'Off: audio is deleted right after transcription.';
}
