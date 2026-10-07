import type { MicrophoneStatus } from '@/audio/microphoneManager';
import type { RecordingMode } from '@/features/speech/captureView';
import type { PracticeActions, PracticeViewModel } from '../practiceViewModel';

/** What the composer shows and can do about listening, derived from the capture view. */
export type ComposerVoice = {
  level: number;
  mode?: RecordingMode;
  held: boolean;
  heardSpeech: boolean;
  micStatus: MicrophoneStatus | 'unmanaged';
  micError: string;
  onCancel: () => void;
  onHold: (held: boolean) => void;
  onPauseMic: () => void;
  onResumeMic: () => void;
};

export function composerVoice(model: PracticeViewModel, actions: PracticeActions): ComposerVoice {
  return {
    level: model.level,
    mode: model.recordingMode,
    held: model.held,
    heardSpeech: model.heardSpeech,
    micStatus: model.micStatus,
    micError: model.micError,
    onCancel: actions.cancelRecording,
    onHold: actions.holdListening,
    onPauseMic: actions.pauseMic,
    onResumeMic: actions.resumeMic,
  };
}

export function listeningLabel(mode: RecordingMode | undefined): string {
  return mode === 'auto' ? 'Listening… (Esc to cancel)' : 'Recording… (Esc to cancel)';
}

export function micStatusLabel(status: MicrophoneStatus | 'unmanaged'): string {
  switch (status) {
    case 'opening':
    case 'warming':
      return 'Microphone warming up…';
    case 'ready':
      return 'Microphone ready';
    case 'paused':
      return 'Microphone paused';
    case 'error':
      return 'Microphone unavailable';
    default:
      return '';
  }
}
