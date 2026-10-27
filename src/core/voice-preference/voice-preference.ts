export type VoiceEngineChoice = 'natural' | 'system';

export const NATURAL_VOICE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type NaturalVoiceId = (typeof NATURAL_VOICE_IDS)[number];

type NaturalVoiceGender = 'female' | 'male';

export type NaturalVoice = {
  readonly id: NaturalVoiceId;
  readonly name: string;
  readonly gender: NaturalVoiceGender;
  readonly description: string;
};

function naturalVoice(id: NaturalVoiceId, gender: NaturalVoiceGender, position: number) {
  const label = gender === 'female' ? 'Female' : 'Male';
  return {
    id,
    gender,
    name: `${label} ${position}`,
    description: `${label} voice · English · local`,
  } satisfies NaturalVoice;
}

export const NATURAL_VOICES: readonly NaturalVoice[] = [
  naturalVoice(0, 'female', 1),
  naturalVoice(1, 'female', 2),
  naturalVoice(2, 'female', 3),
  naturalVoice(3, 'female', 4),
  naturalVoice(4, 'female', 5),
  naturalVoice(5, 'male', 1),
  naturalVoice(6, 'male', 2),
  naturalVoice(7, 'male', 3),
  naturalVoice(8, 'male', 4),
  naturalVoice(9, 'male', 5),
];

export const SPEECH_RATE_RANGE = { min: 0.85, max: 1.2 } as const;
export const SPEECH_RATE_OPTIONS = [0.9, 1, 1.1, 1.2] as const;

export type NaturalVoicePreference = {
  engine: VoiceEngineChoice;
  voiceId: NaturalVoiceId;
};

export type SpeechVoicePreference = {
  voiceURI: string | null;
  rate: number;
};

export const DEFAULT_NATURAL_VOICE: NaturalVoicePreference = { engine: 'natural', voiceId: 0 };
export const DEFAULT_SPEECH_VOICE: SpeechVoicePreference = { voiceURI: null, rate: 1 };
