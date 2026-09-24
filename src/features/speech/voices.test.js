import { describe, expect, it } from 'bun:test';
import { clampSpeechRate, getPreferredVoice, getVoiceOptions } from './voices';

function voice(lang, voiceURI) {
  return { lang, voiceURI };
}

describe('speech voice selection', () => {
  it('prefers an English voice without relying on its name', () => {
    const voices = [
      voice('fr-FR', 'french'),
      voice('en-US', 'english-us'),
      voice('en-GB', 'english-uk'),
    ];

    expect(getPreferredVoice(voices)?.voiceURI).toBe('english-us');
    expect(getVoiceOptions(voices).map((option) => option.isEnglish)).toEqual([false, true, true]);
  });

  it('falls back to a system voice when no English voice exists', () => {
    expect(getPreferredVoice([voice('fr-FR', 'french')])?.voiceURI).toBe('french');
    expect(getPreferredVoice([])).toBeNull();
  });

  it('clamps speaking rate to the supported range', () => {
    expect(clampSpeechRate(0.2)).toBe(0.85);
    expect(clampSpeechRate(1.5)).toBe(1.2);
    expect(clampSpeechRate(Number.NaN)).toBe(1);
  });
});
