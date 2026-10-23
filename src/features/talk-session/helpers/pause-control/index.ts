import type { MicrophoneStatus } from '@/core/audio';

export type PauseSignals = {
  micStatus: MicrophoneStatus | 'unmanaged';
  isRecording: boolean;
  isTranscribing: boolean;
  isBusy: boolean;
  isLocked: boolean;
};

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
  if (signals.micStatus === 'paused' || signals.micStatus === 'error') return { isPaused: true };
  return { isPaused: false, disabledReason: disabledReason(signals) };
}
