import {
  MICROPHONE_TEST_DURATION_MS,
  type MicrophoneTestState,
  microphoneTestFailureMessage,
} from '@/core/audio';

const SECONDS = MICROPHONE_TEST_DURATION_MS / 1000;

export function testDescription(state: MicrophoneTestState): string {
  switch (state.tag) {
    case 'idle':
      return `Record yourself, then listen back. It stops by itself after ${SECONDS} seconds.`;
    case 'requesting':
      return 'Preparing the microphone (about 3 seconds). Wait for Recording before speaking.';
    case 'recording':
      return `Recording… ${Math.min(SECONDS, Math.ceil(state.elapsedMs / 1000))} s of ${SECONDS} s.`;
    case 'stopping':
      return 'Finishing the recording…';
    case 'recorded':
      return `Ready to play back (${Math.round(state.durationMs / 1000)} s). Not saved or transcribed.`;
    case 'error':
      return microphoneTestFailureMessage(state.failure);
  }
}

export function recordLabel(state: MicrophoneTestState): string {
  return state.tag === 'recorded' || state.tag === 'error' ? 'Record again' : 'Record';
}
