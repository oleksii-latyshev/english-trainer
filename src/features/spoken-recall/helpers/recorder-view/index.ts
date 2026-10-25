import type { CaptureState } from '@/core/answer-capture';
import type { RecorderView, RecordingStatus } from '../../types';

function statusOf(state: CaptureState): RecordingStatus {
  if (state.tag === 'transcribing' || state.tag === 'transcript') return 'ready';
  return state.tag;
}

function recordingFields(state: CaptureState) {
  if (state.tag === 'ready' || state.tag === 'transcribing') {
    return { durationMs: state.durationMs, playbackUrl: state.playbackUrl };
  }
  if (state.tag === 'transcript') return { durationMs: state.durationMs, playbackUrl: undefined };
  return { durationMs: 0, playbackUrl: undefined };
}

export function recorderViewOf(state: CaptureState): RecorderView {
  const listening = state.tag === 'recording' || state.tag === 'stopping' ? state : undefined;
  return {
    ...recordingFields(state),
    status: statusOf(state),
    error: state.tag === 'error' && !state.failure ? state.message : '',
    elapsedMs: listening?.elapsedMs ?? 0,
    transcript: state.tag === 'transcript' ? state.text.trim() : '',
    failure: state.tag === 'ready' || state.tag === 'error' ? state.failure : undefined,
    isTranscribing: state.tag === 'transcribing',
  };
}
