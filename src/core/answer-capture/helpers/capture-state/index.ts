import type { CaptureState } from '../../types';

export const PRE_ROLL_MS = 300;

export function isCapturing(state: CaptureState): boolean {
  return (
    state.tag === 'requesting' ||
    state.tag === 'recording' ||
    state.tag === 'stopping' ||
    state.tag === 'transcribing'
  );
}

export function canChangeSession(state: CaptureState): boolean {
  return !isCapturing(state);
}

export function preRollMsFor(mode: 'manual' | 'auto', assistantWasSpeaking: boolean): number {
  return mode === 'auto' || assistantWasSpeaking ? 0 : PRE_ROLL_MS;
}

export function stopMeansCancel(heardSpeech: boolean, isWatchingTurn: boolean): boolean {
  return isWatchingTurn && !heardSpeech;
}

export function isAssistantSpeaking(tag: string): boolean {
  return tag === 'speaking' || tag === 'starting' || tag === 'paused';
}
