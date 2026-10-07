import { getVoiceOptions, type SpeechVoiceInfo } from '@/features/speech/voices';

export type VoiceChoice = {
  voiceURI: string;
  name: string;
  /** "American English · Premium": the accent and the macOS quality tier, as far as they are known. */
  description: string;
};

type VoiceLike = SpeechVoiceInfo & { name: string };

const MAX_CHOICES = 4;

/** macOS ships these joke and effect voices as English; none of them is a voice to practise with. */
const NOVELTY_VOICES = new Set([
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'good news',
  'jester',
  'organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
]);

export function isNoveltyVoice(name: string): boolean {
  return NOVELTY_VOICES.has(
    name
      .replace(/\s*\(.*\)\s*$/, '')
      .trim()
      .toLowerCase(),
  );
}

const ACCENTS: Record<string, string> = {
  'en-us': 'American English',
  'en-gb': 'British English',
  'en-au': 'Australian English',
  'en-ca': 'Canadian English',
  'en-ie': 'Irish English',
  'en-in': 'Indian English',
  'en-za': 'South African English',
  'en-nz': 'New Zealand English',
};

/** macOS marks better voices in the name: "Ava (Premium)", "Zoe (Enhanced)". */
export function voiceQuality(name: string): 'premium' | 'enhanced' | 'standard' {
  const lower = name.toLowerCase();
  if (lower.includes('(premium)')) return 'premium';
  if (lower.includes('(enhanced)')) return 'enhanced';
  return 'standard';
}

const QUALITY_RANK = { premium: 0, enhanced: 1, standard: 2 } as const;

function accentLabel(lang: string): string {
  return ACCENTS[lang.toLowerCase().replace('_', '-')] ?? 'English';
}

function qualityLabel(name: string): string | undefined {
  const quality = voiceQuality(name);
  if (quality === 'premium') return 'Premium';
  if (quality === 'enhanced') return 'Enhanced';
  return undefined;
}

/** "Eddy (English (United States))" reads as "Eddy": the accent is already on the second line. */
export function displayName(name: string): string {
  return name.replace(/\s*\(English\b.*\)\s*$/, '').trim() || name;
}

export function describeVoice(voice: VoiceLike): VoiceChoice {
  const quality = qualityLabel(voice.name);
  return {
    voiceURI: voice.voiceURI,
    name: displayName(voice.name),
    description: [accentLabel(voice.lang), quality].filter(Boolean).join(' · '),
  };
}

/**
 * A short list of English voices to pick from: the most natural ones first (Premium, then Enhanced),
 * American before British, never more than four, and always the voice already selected.
 */
export function voiceChoices<T extends VoiceLike>(
  voices: readonly T[],
  selectedVoiceURI: string | null,
): VoiceChoice[] {
  const english = getVoiceOptions([...voices])
    .filter((option) => option.isEnglish && !isNoveltyVoice(option.voice.name))
    .map((option) => option.voice);
  const ranked = english
    .map((voice, index) => ({ voice, index }))
    .sort(
      (a, b) =>
        QUALITY_RANK[voiceQuality(a.voice.name)] - QUALITY_RANK[voiceQuality(b.voice.name)] ||
        accentOrder(a.voice.lang) - accentOrder(b.voice.lang) ||
        a.index - b.index,
    )
    .map((entry) => entry.voice);
  const top = ranked.slice(0, MAX_CHOICES);
  const selected = ranked.find((voice) => voice.voiceURI === selectedVoiceURI);
  const shown =
    selected && !top.includes(selected) ? [...top.slice(0, MAX_CHOICES - 1), selected] : top;
  return shown.map(describeVoice);
}

function accentOrder(lang: string): number {
  const lower = lang.toLowerCase().replace('_', '-');
  if (lower === 'en-us') return 0;
  if (lower === 'en-gb') return 1;
  return 2;
}
