// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { parseVoicePreference } from './voicePreferences';

describe('voice preference', () => {
  it('defaults to the automatic voice at normal speed', () => {
    for (const value of [undefined, null, 'x', []]) {
      expect(parseVoicePreference(value)).toEqual({ voiceURI: null, rate: 1 });
    }
  });

  it('keeps a stored voice and clamps the rate', () => {
    expect(parseVoicePreference({ voiceURI: 'com.apple.Ava', rate: 1.1 })).toEqual({
      voiceURI: 'com.apple.Ava',
      rate: 1.1,
    });
    expect(parseVoicePreference({ voiceURI: '', rate: 9 })).toEqual({ voiceURI: null, rate: 1.2 });
    expect(parseVoicePreference({ rate: 'fast' }).rate).toBe(1);
  });
});
