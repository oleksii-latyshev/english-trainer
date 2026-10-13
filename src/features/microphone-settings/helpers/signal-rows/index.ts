import type { AudioSignalSummary } from '@/core/audio';

const MS_PER_SECOND = 1000;

export function processingLabel(value: boolean | undefined): string {
  if (value === undefined) return 'Not reported';
  return value ? 'On' : 'Off';
}

export function decibelLabel(rms: number): string {
  return rms > 0 ? `${Math.round(20 * Math.log10(rms))} dB` : 'Silent';
}

export function windowRangeLabel(window: AudioSignalSummary['windows'][number]): string {
  const start = (window.offsetMs / MS_PER_SECOND).toFixed(0);
  const end = ((window.offsetMs + window.durationMs) / MS_PER_SECOND).toFixed(1);
  return `${start}–${end}s`;
}

export function secondsLabel(ms: number): string {
  return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
}
