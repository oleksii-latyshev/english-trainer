import type { CaptureState } from '@/core/answer-capture';

export function isAnswerCaptureStarted(state: CaptureState): boolean {
  return state.tag === 'requesting' || state.tag === 'recording';
}

export function isAnswerRecording(state: CaptureState): boolean {
  return isAnswerCaptureStarted(state) || state.tag === 'stopping';
}

export function exampleCueWasInterrupted(
  wasCapturingAtRequest: boolean,
  requestCaptureEpoch: number,
  currentCaptureEpoch: number,
  isCapturing: boolean,
): boolean {
  return wasCapturingAtRequest || requestCaptureEpoch !== currentCaptureEpoch || isCapturing;
}
