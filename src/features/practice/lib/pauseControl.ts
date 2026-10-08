import type { MicrophoneStatus } from '@/audio/microphoneManager';

export type PauseSignals = {
  micStatus: MicrophoneStatus | 'unmanaged';
  isRecording: boolean;
  isTranscribing: boolean;
  /** Eva is replying or the session is busy. */
  isBusy: boolean;
  /** The screen locked the composer (recall or retry). */
  isLocked: boolean;
};

/** The header's Pause / Resume control: always shown, and when it cannot act it says why. */
export type PauseControl = { isPaused: boolean; disabledReason?: string };

function disabledReason(signals: PauseSignals): string | undefined {
  if (signals.micStatus === 'off' || signals.micStatus === 'unmanaged') {
    return 'The microphone is not open yet.';
  }
  if (signals.isRecording) return 'Finish or cancel the recording first.';
  if (signals.isTranscribing) return 'Wait until your answer is transcribed.';
  if (signals.isBusy) return 'Eva is replying. You can pause when she is done.';
  if (signals.isLocked) return 'Finish the current step first.';
  return undefined;
}

export function pauseControl(signals: PauseSignals): PauseControl {
  // Resuming is always allowed: it is how a released or failed microphone comes back.
  if (signals.micStatus === 'paused' || signals.micStatus === 'error') return { isPaused: true };
  return { isPaused: false, disabledReason: disabledReason(signals) };
}
