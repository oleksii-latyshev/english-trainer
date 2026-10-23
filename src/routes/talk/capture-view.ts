import type { CaptureState } from '@/core/answer-capture';
import type { MicrophoneSnapshot } from '@/core/audio';
import type { SpeechTiming } from '@/core/speech';
import type { CaptureView, RecordingStatus } from '@/features/practice/practiceViewModel';

function recordingFields(state: CaptureState) {
  if (state.tag === 'ready' || state.tag === 'transcribing') {
    return { durationMs: state.durationMs, playbackUrl: state.playbackUrl };
  }
  if (state.tag === 'transcript') return { durationMs: state.durationMs, playbackUrl: undefined };
  return { durationMs: 0, playbackUrl: undefined };
}

function statusOf(state: CaptureState): RecordingStatus {
  if (state.tag === 'transcribing' || state.tag === 'transcript') return 'ready';
  return state.tag;
}

export function captureViewOf(
  state: CaptureState,
  timing: SpeechTiming,
  requestId: number,
  mic: MicrophoneSnapshot,
): CaptureView {
  const listening = state.tag === 'recording' || state.tag === 'stopping' ? state : undefined;
  return {
    ...recordingFields(state),
    status: statusOf(state),
    error: state.tag === 'error' && !state.failure ? state.message : '',
    elapsedMs: listening?.elapsedMs ?? 0,
    level: listening?.level ?? 0,
    recordingMode: listening?.mode,
    held: listening?.held ?? false,
    heardSpeech: listening?.heardSpeech ?? false,
    liveText: listening?.liveText ?? '',
    micStatus: mic.status,
    micError: mic.error,
    transcript: state.tag === 'transcript' ? state.text : undefined,
    transcriptionFailure:
      state.tag === 'ready' || state.tag === 'error' ? state.failure : undefined,
    transcribing: state.tag === 'transcribing',
    timing,
    currentRequestId: requestId,
    speechStoppedAtMs: state.tag === 'transcript' ? state.speechStoppedAtMs : undefined,
    actualInput: state.actualInput,
  };
}
