import type { ActualAudioInput, MicrophoneStatus } from '@/core/audio';
import type { PracticeState } from '@/core/practice-session';
import type { SpeechTiming, TranscriptionRecovery } from '@/core/speech';
import type { PracticePhase } from '@/lib/practiceOptions';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

export type RecordingMode = 'manual' | 'auto';

export type CaptureView = {
  status: RecordingStatus;
  error: string;
  elapsedMs: number;
  durationMs: number;
  playbackUrl?: string;
  transcript?: string;
  transcriptionFailure?: TranscriptionRecovery;
  transcribing: boolean;
  timing: SpeechTiming;
  currentRequestId: number;
  speechStoppedAtMs?: number;
  actualInput?: ActualAudioInput;
  level: number;
  recordingMode?: RecordingMode;
  held: boolean;
  heardSpeech: boolean;
  liveText: string;
  micStatus: MicrophoneStatus | 'unmanaged';
  micError: string;
};

export type PracticeViewModel = CaptureView & {
  practice: PracticeState;
  practiceError: string;
  busy: boolean;
  canChangeSession: boolean;
};

export type PracticeActions = {
  startRecording: (discardPreRoll?: boolean) => void;
  stopRecording: () => void;
  startAutoListen: () => void;
  cancelRecording: () => void;
  holdListening: (held: boolean) => void;
  pauseMic: () => void;
  resumeMic: () => void;
  transcribeRecording: () => void;
  resetCapture: () => void;
  startPractice: () => void;
  finishPractice: () => void;
  transitionPracticePhase: (phase: PracticePhase) => void;
};
