import { NATURAL_VOICES, type NaturalVoiceId } from '@/core/voice-preference';

export const VOICE_SAMPLE = "Hi, I'm glad you picked my voice!";

export const VOICE_OPTIONS = NATURAL_VOICES.map((voice) => ({
  value: String(voice.id),
  label: voice.name,
  description: voice.description,
}));

export function voiceIdFromOption(value: string): NaturalVoiceId | undefined {
  return NATURAL_VOICES.find((voice) => String(voice.id) === value)?.id;
}
