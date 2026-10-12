import type { AudioSignalSummary } from './helpers/audio-signal';

export type ActualAudioInput = {
  deviceId: string;
  label: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
};

export type AudioInputOption = {
  deviceId: string;
  label: string;
};

export type StorageStatus = {
  available: boolean;
  warning?: string;
};

export type AudioFrame = { samples: Float32Array; rms: number; durationMs: number };

export type RecordedAudio = {
  wav: Blob;
  durationMs: number;
  signal: AudioSignalSummary;
};

export type MicrophoneStatus = 'off' | 'opening' | 'warming' | 'ready' | 'paused' | 'error';
export type MicrophoneSnapshot = { status: MicrophoneStatus; error: string };

export type TurnEvent = { readonly _tag: 'SpeechStarted' } | { readonly _tag: 'TurnEnded' };

export const MAX_PRE_ROLL_MS = 300;
export const MAX_SNAPSHOT_MS = 30_000;
export const WHISPER_SAMPLE_RATE_HZ = 16_000;
export const STARTUP_TIMEOUT_MS = 8000;
