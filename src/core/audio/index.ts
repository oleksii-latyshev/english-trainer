export type {
  ActualAudioInput,
  AudioInputOption,
  MicrophoneStatus,
  RecordedAudio,
  TurnEvent,
} from './audio';
export { MIC_DISCONNECTED_MESSAGE, MicrophoneError } from './errors';
export { type AudioSignalSummary, signalMeterValue } from './helpers/audio-signal';

export {
  MICROPHONE_TEST_DURATION_MS,
  type MicrophoneTestState,
  microphoneTestFailureMessage,
} from './helpers/microphone-test';
export {
  clipPhaseAtom,
  microphoneSnapshotAtom,
  stopClipAtom,
} from './model/atoms';
export { preferredMicrophoneAtom, readPreferredMicrophone } from './model/preferred-microphone';
export { AudioLive, audioAtomContext } from './model/runtime';
export { useAudioInputOptions } from './model/use-audio-input-options';
export { useMicrophoneTest } from './model/use-microphone-test';
export { usePreferredMicrophone } from './model/use-preferred-microphone';

export type { Capture } from './services/capture-engine';
export {
  type ClipPhase,
  ClipRecorder,
  IDLE_CLIP,
  type RecordedClip,
} from './services/clip-recorder-service';
export { Microphone, type MicrophoneSession } from './services/microphone-service';
export { WarmMicrophone } from './services/warm-microphone-service';
