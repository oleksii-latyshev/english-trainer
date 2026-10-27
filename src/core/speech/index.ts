export { naturalAvailability } from './helpers/natural-availability';

export { createSpeechGate } from './helpers/speech-gate';

export {
  transcriptionFailureOutcome,
  transcriptOutcome,
} from './helpers/transcript-outcome';
export type { TranscriptionRecovery } from './helpers/transcription-recovery';
export {
  naturalAvailabilityAtom,
  previewingNaturalVoiceAtom,
  previewNaturalVoiceAtom,
  speechStateAtom,
} from './model/atoms';
export { createPlayback } from './model/playback';
export { SpeechRecognitionLive } from './model/recognition-runtime';
export { useSpeech } from './model/use-speech';
export { liveTranscript } from './services/live-transcript';
export { rescueTranscript } from './services/rescue-transcript';
export {
  SpeechRecognition,
  type SpeechRecognitionFailure,
  type TranscribedAnswer,
} from './services/speech-recognition-service';
export { SpeechRecognitionSettings } from './services/speech-recognition-settings-service';
export type {
  SpeechTiming,
  StreamHandle,
} from './types';
