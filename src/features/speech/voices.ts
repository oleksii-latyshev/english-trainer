export type VoiceOption = {
  voice: SpeechSynthesisVoice;
  isEnglish: boolean;
};

export type SpeechVoiceInfo = Pick<SpeechSynthesisVoice, 'lang' | 'voiceURI'>;

export function getVoiceOptions<T extends SpeechVoiceInfo>(voices: T[]) {
  return voices.map((voice) => ({ voice, isEnglish: voice.lang.toLowerCase().startsWith('en') }));
}

export function getPreferredVoice<T extends SpeechVoiceInfo>(voices: T[]): T | null {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  return (
    english.find((voice) => voice.lang.toLowerCase() === 'en-us') ??
    english.find((voice) => voice.lang.toLowerCase() === 'en-gb') ??
    english[0] ??
    voices[0] ??
    null
  );
}

export function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.2, Math.max(0.85, rate));
}
