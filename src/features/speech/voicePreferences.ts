import { createLocalPreference, isRecord } from '@/lib/localPreference';
import { clampSpeechRate } from './voices';

/** The speeds Settings offers; any stored rate is clamped to the range speech accepts. */
export const SPEECH_RATE_OPTIONS = [0.9, 1, 1.1, 1.2] as const;

export const VOICE_PREFERENCE_KEY = 'english_trainer_voice';

export type VoicePreference = {
  /** The voice the learner picked; null means "use the preferred English voice". */
  voiceURI: string | null;
  rate: number;
};

export function parseVoicePreference(value: unknown): VoicePreference {
  if (!isRecord(value)) return { voiceURI: null, rate: 1 };
  const voiceURI =
    typeof value.voiceURI === 'string' && value.voiceURI.length > 0 ? value.voiceURI : null;
  const rate = typeof value.rate === 'number' ? clampSpeechRate(value.rate) : 1;
  return { voiceURI, rate };
}

export const voicePreference = createLocalPreference<VoicePreference>(
  VOICE_PREFERENCE_KEY,
  parseVoicePreference,
);
