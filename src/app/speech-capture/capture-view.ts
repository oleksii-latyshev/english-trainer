import type { ActualAudioInput, MicrophoneStatus } from '@/core/audio';
import type { TranscriptionRecovery } from '@/core/speech';
import type { SpeechTiming } from './timing-panel';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

export type RecordingMode = 'manual' | 'auto';

export type Recording = { playbackUrl: string; durationMs: number; speechStoppedAtMs: number };

export type ListeningState = {
  elapsedMs: number;
  level: number;
  mode: RecordingMode;
  held: boolean;
  heardSpeech: boolean;
  liveText: string;
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
  liveText: string;
  micStatus: MicrophoneStatus | 'unmanaged';
  micError: string;
};

export const PRE_ROLL_MS = 300;

export function preRollMsFor(mode: RecordingMode, assistantWasSpeaking: boolean): number {
  return mode === 'auto' || assistantWasSpeaking ? 0 : PRE_ROLL_MS;
}

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
    liveText: listening?.liveText ?? '',
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

export function stopMeansCancel(heardSpeech: boolean, isWatchingTurn: boolean): boolean {
  return isWatchingTurn && !heardSpeech;
}
