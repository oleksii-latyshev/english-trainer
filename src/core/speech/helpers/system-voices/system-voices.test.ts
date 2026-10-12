import { describe, expect, it } from 'bun:test';
import { clampSpeechRate, getPreferredVoice, getVoiceOptions } from './index';

function voice(lang: string, voiceURI: string) {
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

  it('skips novelty voices and ranks quality before accent', () => {
    const voices = [
      { ...voice('en-US', 'albert'), name: 'Albert' },
      { ...voice('en-US', 'samantha'), name: 'Samantha' },
    ];
    expect(getPreferredVoice(voices)?.voiceURI).toBe('samantha');

    const qualityVoices = [
      { ...voice('en-US', 'standard-us'), name: 'Standard' },
      { ...voice('en-GB', 'premium-uk'), name: 'Premium (Premium)' },
    ];
    expect(getPreferredVoice(qualityVoices)?.voiceURI).toBe('premium-uk');
  });

  it('preserves stable locale order when metadata is missing', () => {
    const voices = [
      voice('en-GB', 'english-uk'),
      voice('en-US', 'english-us-first'),
      voice('en-US', 'english-us-second'),
    ];
    expect(getPreferredVoice(voices)?.voiceURI).toBe('english-us-first');
  });

  it('falls back to a system voice when no English voice exists', () => {
    expect(getPreferredVoice([voice('fr-FR', 'french')])?.voiceURI).toBe('french');
    expect(getPreferredVoice([])).toBeNull();
  });

  it('prefers a non-novelty installed voice when no suitable English voice exists', () => {
    const voices = [
      { ...voice('en-US', 'novelty'), name: 'Albert' },
      { ...voice('fr-FR', 'french'), name: 'Amelie' },
    ];
    expect(getPreferredVoice(voices)?.voiceURI).toBe('french');

    const noveltyOnly = [{ ...voice('en-US', 'novelty'), name: 'Albert' }];
    expect(getPreferredVoice(noveltyOnly)?.voiceURI).toBe('novelty');
  });

  it('clamps speaking rate to the supported range', () => {
    expect(clampSpeechRate(0.2)).toBe(0.85);
    expect(clampSpeechRate(1.5)).toBe(1.2);
    expect(clampSpeechRate(Number.NaN)).toBe(1);
  });
});
