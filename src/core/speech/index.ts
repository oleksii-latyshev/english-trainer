export { naturalAvailability } from './helpers/natural-availability';
export { cleanSpeechText } from './helpers/reply-sentences';
export { createSpeechGate, type SpeechGate } from './helpers/speech-gate';
export {
  clampSpeechRate,
  getPreferredVoice,
  getVoiceOptions,
  type SpeechVoiceInfo,
  type VoiceOption,
} from './helpers/system-voices';
export { isNoveltyVoice, voiceQuality } from './helpers/system-voices/voice-metadata';
export {
  type TranscriptionFailureOutcome,
  type TranscriptOutcome,
  transcriptionFailureOutcome,
  transcriptOutcome,
} from './helpers/transcript-outcome';
export {
  type TranscriptionRecovery,
  transcriptionRecovery,
} from './helpers/transcription-recovery';
export {
  naturalAvailabilityAtom,
  previewingNaturalVoiceAtom,
  previewNaturalVoiceAtom,
  speechStateAtom,
} from './model/atoms';
export { createPlayback, type Playback } from './model/playback';
export {
  SpeechRecognitionLive,
  type SpeechRecognitionServices,
  speechRecognitionRuntime,
} from './model/recognition-runtime';
export { type SpeechControls, useSpeech } from './model/use-speech';
export {
  LIVE_INTERVAL,
  type LiveTranscriptSource,
  liveTranscript,
} from './services/live-transcript';
export { rescueTranscript } from './services/rescue-transcript';
export {
  SpeechRecognition,
  type SpeechRecognitionFailure,
  type TranscribedAnswer,
} from './services/speech-recognition-service';
export { SpeechRecognitionSettings } from './services/speech-recognition-settings-service';
export type {
  NaturalAvailability,
  SpeechState,
  SpeechTiming,
  StreamHandle,
  StreamOptions,
} from './types';
