import type { ActualAudioInput } from '@/audio/types';
import type { SpeechTiming } from './TimingPanel';
import type { TranscriptionRecovery } from './transcriptionRecovery';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

export type Recording = { playbackUrl: string; durationMs: number; speechStoppedAtMs: number };

export type CaptureState =
  | { tag: 'idle' | 'requesting'; actualInput?: ActualAudioInput }
  | { tag: 'recording' | 'stopping'; elapsedMs: number; actualInput?: ActualAudioInput }
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
};

function recordingStatus(state: CaptureState): RecordingStatus {
  if (state.tag === 'transcribing' || state.tag === 'transcript') return 'ready';
  return state.tag;
}

export function viewFor(
  state: CaptureState,
  timing: SpeechTiming,
  currentRequestId: number,
): CaptureView {
  const isCompleted =
    state.tag === 'ready' || state.tag === 'transcribing' || state.tag === 'transcript';
  const isPlayback = state.tag === 'ready' || state.tag === 'transcribing';
  return {
    status: recordingStatus(state),
    error: state.tag === 'error' && !state.failure ? state.message : '',
    elapsedMs: state.tag === 'recording' || state.tag === 'stopping' ? state.elapsedMs : 0,
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
