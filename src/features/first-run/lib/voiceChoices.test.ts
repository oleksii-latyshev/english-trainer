// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  describeVoice,
  displayName,
  isNoveltyVoice,
  voiceChoices,
  voiceQuality,
} from './voiceChoices';

const voice = (name: string, lang: string) => ({ name, lang, voiceURI: `uri:${name}` });

describe('voice choices', () => {
  it('reads the quality tier from the macOS voice name', () => {
    expect(voiceQuality('Ava (Premium)')).toBe('premium');
    expect(voiceQuality('Zoe (Enhanced)')).toBe('enhanced');
    expect(voiceQuality('Samantha')).toBe('standard');
  });

  it('describes accent and tier without inventing a personality', () => {
    expect(describeVoice(voice('Serena (Premium)', 'en-GB')).description).toBe(
      'British English · Premium',
    );
    expect(describeVoice(voice('Fred', 'en_US')).description).toBe('American English');
    expect(describeVoice(voice('Odd', 'en-XX')).description).toBe('English');
  });

  it('drops the locale a multilingual voice carries in its name', () => {
    expect(displayName('Eddy (English (United States))')).toBe('Eddy');
    expect(displayName('Ava (Premium)')).toBe('Ava (Premium)');
    expect(displayName('(English)')).toBe('(English)');
  });

  it('lists English voices only, best first, at most four', () => {
    const choices = voiceChoices(
      [
        voice('Amelie', 'fr-FR'),
        voice('Fred', 'en-US'),
        voice('Serena (Premium)', 'en-GB'),
        voice('Ava (Premium)', 'en-US'),
        voice('Zoe (Enhanced)', 'en-US'),
        voice('Tom', 'en-US'),
        voice('Alex', 'en-US'),
      ],
      null,
    );
    expect(choices.map((choice) => choice.name)).toEqual([
      'Ava (Premium)',
      'Serena (Premium)',
      'Zoe (Enhanced)',
      'Fred',
    ]);
  });

  it('keeps the selected voice in the list even when it ranks low', () => {
    const voices = [
      voice('A (Premium)', 'en-US'),
      voice('B (Premium)', 'en-US'),
      voice('C (Premium)', 'en-US'),
      voice('D (Premium)', 'en-US'),
      voice('Plain', 'en-US'),
    ];
    const choices = voiceChoices(voices, 'uri:Plain');
    expect(choices).toHaveLength(4);
    expect(choices.map((choice) => choice.name)).toContain('Plain');
  });

  it('leaves out the macOS novelty voices', () => {
    expect(isNoveltyVoice('Bad News')).toBe(true);
    expect(isNoveltyVoice('Zarvox')).toBe(true);
    expect(isNoveltyVoice('Samantha')).toBe(false);
    const choices = voiceChoices([voice('Bahh', 'en-US'), voice('Samantha', 'en-US')], null);
    expect(choices.map((choice) => choice.name)).toEqual(['Samantha']);
  });

  it('is empty when no English voice exists', () => {
    expect(voiceChoices([voice('Amelie', 'fr-FR')], null)).toEqual([]);
  });
});
