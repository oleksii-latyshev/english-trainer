import type { TranscriptionRecovery } from '@/core/speech';
import type { RecordingStatus } from '../../types';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

function clock(durationMs: number): string {
  const seconds = Math.floor(durationMs / MS_PER_SECOND);
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

export function recordingLabel(
  status: RecordingStatus,
  elapsedMs: number,
  durationMs: number,
): string {
  switch (status) {
    case 'requesting':
      return 'Waiting for microphone permission…';
    case 'recording':
      return `Recording · ${clock(elapsedMs)}`;
    case 'stopping':
      return 'Finishing recording…';
    case 'ready':
      return `Ready to listen · ${clock(durationMs)}`;
    case 'error':
      return 'Ready to try again';
    case 'idle':
      return 'Microphone ready when you are';
  }
}

export function transcribeButtonLabel(
  isTranscribing: boolean,
  failure: TranscriptionRecovery | undefined,
): string {
  if (isTranscribing) return 'Transcribing locally…';
  if (failure?.kind === 'setup') return 'Retry after setup';
  return failure ? 'Retry transcription' : 'Transcribe';
}

export function recordButtonLabel(status: RecordingStatus, hasTranscript: boolean): string {
  if (status === 'error') return 'Try recording again';
  if (status === 'ready' || hasTranscript) return 'Record again';
  return 'Start recording';
}
