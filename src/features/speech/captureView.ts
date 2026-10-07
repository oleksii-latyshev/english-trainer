import type { MicrophoneStatus } from '@/audio/microphoneManager';
import type { ActualAudioInput } from '@/audio/types';
import type { SpeechTiming } from './TimingPanel';
import type { TranscriptionRecovery } from './transcriptionRecovery';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

/** `auto` listening started by itself after the assistant finished speaking; `manual` was requested. */
export type RecordingMode = 'manual' | 'auto';

export type Recording = { playbackUrl: string; durationMs: number; speechStoppedAtMs: number };

export type ListeningState = {
  elapsedMs: number;
  /** Live input level, 0 to 1. */
  level: number;
  mode: RecordingMode;
  /** "Keep listening" is on: the turn does not end by silence. */
  held: boolean;
  heardSpeech: boolean;
};

export type CaptureState =
  | { tag: 'idle' | 'requesting'; actualInput?: ActualAudioInput }
  | ({ tag: 'recording' | 'stopping'; actualInput?: ActualAudioInput } & ListeningState)
  | ({ tag: 'ready'; failure?: TranscriptionRecovery; actualInput?: ActualAudioInput } & Recording)
  | ({ tag: 'transcribing'; actualInput?: ActualAudioInput } & Recording)
  | {
      tag: 'transcript';
      text: string;
      durationMs: number;
      speechStoppedAtMs: number;
      actualInput?: ActualAudioInput;
    }
  | {
      tag: 'error';
      message: string;
      failure?: TranscriptionRecovery;
      actualInput?: ActualAudioInput;
    };

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
  /** `unmanaged` when no warm microphone session is attached (each recording opens its own). */
  micStatus: MicrophoneStatus | 'unmanaged';
  micError: string;
};

/** Pre-roll keeps the first syllable but must not pick up the assistant's own voice. */
export const PRE_ROLL_MS = 300;

export function preRollMsFor(mode: RecordingMode, assistantWasSpeaking: boolean): number {
  return mode === 'auto' || assistantWasSpeaking ? 0 : PRE_ROLL_MS;
}

/** A recording, its hand-off to transcription, or the wait for the microphone is in progress. */
export function isCapturing(state: CaptureState): boolean {
  return (
    state.tag === 'requesting' ||
    state.tag === 'recording' ||
    state.tag === 'stopping' ||
    state.tag === 'transcribing'
  );
}

function recordingStatus(state: CaptureState): RecordingStatus {
  if (state.tag === 'transcribing' || state.tag === 'transcript') return 'ready';
  return state.tag;
}

function listeningFields(state: CaptureState) {
  const listening = state.tag === 'recording' || state.tag === 'stopping' ? state : undefined;
  return {
    elapsedMs: listening?.elapsedMs ?? 0,
    level: listening?.level ?? 0,
    recordingMode: listening?.mode,
    held: listening?.held ?? false,
    heardSpeech: listening?.heardSpeech ?? false,
  };
}

export function viewFor(
  state: CaptureState,
  timing: SpeechTiming,
  currentRequestId: number,
  mic: { status: MicrophoneStatus | 'unmanaged'; error: string } = {
    status: 'unmanaged',
    error: '',
  },
): CaptureView {
  const isCompleted =
    state.tag === 'ready' || state.tag === 'transcribing' || state.tag === 'transcript';
  const isPlayback = state.tag === 'ready' || state.tag === 'transcribing';
  return {
    status: recordingStatus(state),
    error: state.tag === 'error' && !state.failure ? state.message : '',
    ...listeningFields(state),
    micStatus: mic.status,
    micError: mic.error,
    durationMs: isCompleted ? state.durationMs : 0,
    playbackUrl: isPlayback ? state.playbackUrl : undefined,
    transcript: state.tag === 'transcript' ? state.text : undefined,
    transcriptionFailure:
      state.tag === 'ready' || state.tag === 'error' ? state.failure : undefined,
    transcribing: state.tag === 'transcribing',
    timing,
    currentRequestId,
    speechStoppedAtMs: state.tag === 'transcript' ? state.speechStoppedAtMs : undefined,
    actualInput: state.actualInput,
  };
}

/**
 * Stopping before any speech was heard means "stop listening", not "send an empty answer".
 * Only the warm session can tell; without turn watching the recording is transcribed as before.
 */
export function stopMeansCancel(heardSpeech: boolean, isWatchingTurn: boolean): boolean {
  return isWatchingTurn && !heardSpeech;
}
