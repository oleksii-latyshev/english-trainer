import { isNoveltyVoice, voiceQuality } from './lib/voiceMetadata';

export type VoiceOption = {
  voice: SpeechSynthesisVoice;
  isEnglish: boolean;
};

export type SpeechVoiceInfo = Pick<SpeechSynthesisVoice, 'lang' | 'voiceURI'> & {
  name?: string;
};

export function getVoiceOptions<T extends SpeechVoiceInfo>(voices: T[]) {
  return voices.map((voice) => ({ voice, isEnglish: voice.lang.toLowerCase().startsWith('en') }));
}

export function getPreferredVoice<T extends SpeechVoiceInfo>(voices: T[]): T | null {
  const english = voices
    .map((voice, index) => ({ voice, index }))
    .filter(({ voice }) => voice.lang.toLowerCase().startsWith('en'))
    .filter(({ voice }) => !isNoveltyVoice(voice.name))
    .sort(
      (a, b) =>
        qualityRank(voiceQuality(a.voice.name)) - qualityRank(voiceQuality(b.voice.name)) ||
        accentOrder(a.voice.lang) - accentOrder(b.voice.lang) ||
        a.index - b.index,
    );
  if (english[0]) return english[0].voice;

  return voices.find((voice) => !isNoveltyVoice(voice.name)) ?? voices[0] ?? null;
}

function qualityRank(quality: ReturnType<typeof voiceQuality>): number {
  if (quality === 'premium') return 0;
  if (quality === 'enhanced') return 1;
  return 2;
}

function accentOrder(lang: string): number {
  const normalized = lang.toLowerCase().replace('_', '-');
  if (normalized === 'en-us') return 0;
  if (normalized === 'en-gb') return 1;
  return 2;
}

export function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.2, Math.max(0.85, rate));
}
