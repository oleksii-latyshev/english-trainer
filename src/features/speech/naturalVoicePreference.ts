import { createLocalPreference, isRecord } from '@/lib/localPreference';
import { NATURAL_VOICES } from '@/lib/naturalVoice';
export type VoiceEngineChoice = 'natural' | 'system';
export type NaturalVoicePreference = { engine: VoiceEngineChoice; voiceId: number };
export function parseNaturalVoicePreference(value: unknown): NaturalVoicePreference {
  if (!isRecord(value)) return { engine: 'natural', voiceId: 0 };
  const engine = value.engine === 'system' ? 'system' : 'natural';
  const voiceId = NATURAL_VOICES.find((voice) => voice.id === value.voiceId)?.id ?? 0;
  return { engine, voiceId };
}
export const naturalVoicePreference = createLocalPreference(
  'english_trainer_natural_voice',
  parseNaturalVoicePreference,
);
