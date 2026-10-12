export { naturalAvailability } from './helpers/natural-availability';
export { cleanSpeechText } from './helpers/reply-sentences';
export {
  clampSpeechRate,
  getPreferredVoice,
  getVoiceOptions,
  type SpeechVoiceInfo,
  type VoiceOption,
} from './helpers/system-voices';
export { isNoveltyVoice, voiceQuality } from './helpers/system-voices/voice-metadata';
export {
  naturalAvailabilityAtom,
  previewingNaturalVoiceAtom,
  previewNaturalVoiceAtom,
} from './model/atoms';
export { type SpeechControls, useSpeech } from './model/use-speech';
export type { NaturalAvailability, SpeechState, StreamHandle, StreamOptions } from './types';
