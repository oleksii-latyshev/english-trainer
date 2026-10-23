import type { SpeechTiming } from '@/core/speech';

export const TIMING_STAGES: readonly { label: string; key: keyof SpeechTiming }[] = [
  { label: 'Mic start', key: 'captureStartMs' },
  { label: 'Audio buffer', key: 'captureFinalizationMs' },
  { label: 'Whisper STT', key: 'sttMs' },
  { label: 'System voice', key: 'ttsStartMs' },
  { label: 'AI first text', key: 'firstTokenMs' },
  { label: 'AI complete reply', key: 'providerCompleteMs' },
  { label: 'Send to first audio', key: 'sendToAudioMs' },
  { label: 'Speech end to first AI audio', key: 'firstAiAudioMs' },
];

export function formatTiming(value?: number): string {
  return value === undefined ? '—' : `${Math.round(value)} ms`;
}

export function hasTiming(timing: SpeechTiming): boolean {
  return TIMING_STAGES.some((stage) => timing[stage.key] !== undefined);
}
