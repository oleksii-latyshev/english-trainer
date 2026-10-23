import type { CaptureState } from '@/core/answer-capture';
import type { CaptureStatus } from '../turn-state';

export function captureStatusOf(state: CaptureState): CaptureStatus {
  if (state.tag === 'transcribing' || state.tag === 'transcript') return 'ready';
  return state.tag;
}

export function listeningOf(state: CaptureState) {
  return state.tag === 'recording' || state.tag === 'stopping' ? state : undefined;
}
