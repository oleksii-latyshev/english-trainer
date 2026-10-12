import { NATURAL_VOICES, type NaturalVoiceId } from '@/core/voice-preference';
import type { SpeechEngineChoice } from '../../types';
import { getPreferredVoice, type SpeechVoiceInfo } from '../system-voices';

const NATURAL_URI_PREFIX = 'natural:';

export type EngineInputs = {
  readonly requestedVoiceURI: string | undefined;
  readonly isNaturalReady: boolean;
  readonly naturalVoiceId: NaturalVoiceId;
  readonly systemVoices: readonly SpeechVoiceInfo[];
  readonly savedVoiceURI: string | null;
};

export function naturalVoiceURI(voiceId: NaturalVoiceId): string {
  return `${NATURAL_URI_PREFIX}${voiceId}`;
}

export function naturalVoiceIdOf(voiceURI: string | undefined): NaturalVoiceId | undefined {
  if (!voiceURI?.startsWith(NATURAL_URI_PREFIX)) return undefined;
  return NATURAL_VOICES.find((voice) => naturalVoiceURI(voice.id) === voiceURI)?.id;
}

export function resolveSystemVoiceURI(
  systemVoices: readonly SpeechVoiceInfo[],
  savedVoiceURI: string | null,
): string | null {
  const saved = systemVoices.find((voice) => voice.voiceURI === savedVoiceURI);
  return saved?.voiceURI ?? getPreferredVoice([...systemVoices])?.voiceURI ?? null;
}

export function chooseEngine(inputs: EngineInputs): SpeechEngineChoice | null {
  const requestedNatural = naturalVoiceIdOf(inputs.requestedVoiceURI);
  const requestsSystem = inputs.requestedVoiceURI !== undefined && requestedNatural === undefined;
  const resolvedSystemURI = resolveSystemVoiceURI(inputs.systemVoices, inputs.savedVoiceURI);
  if (!requestsSystem && inputs.isNaturalReady) {
    return {
      kind: 'natural',
      voiceId: requestedNatural ?? inputs.naturalVoiceId,
      fallbackVoiceURI: getPreferredVoice([...inputs.systemVoices])?.voiceURI ?? null,
    };
  }
  if (inputs.systemVoices.length === 0) return null;
  return {
    kind: 'system',
    voiceURI: requestsSystem ? inputs.requestedVoiceURI : resolvedSystemURI,
  };
}
