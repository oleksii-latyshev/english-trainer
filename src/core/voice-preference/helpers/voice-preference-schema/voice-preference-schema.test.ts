import { describe, expect, it } from 'bun:test';
import { decodeNaturalVoice, decodeSpeechVoice } from './index';

describe('natural voice preference', () => {
  it('defaults to the first natural voice', () => {
    for (const value of [undefined, null, 'x', []]) {
      expect(decodeNaturalVoice(value)).toEqual({ engine: 'natural', voiceId: 0 });
    }
  });

  it('keeps a stored choice and replaces what is invalid field by field', () => {
    expect(decodeNaturalVoice({ engine: 'system', voiceId: 9 })).toEqual({
      engine: 'system',
      voiceId: 9,
    });
    expect(decodeNaturalVoice({ engine: 'cloud', voiceId: 999 })).toEqual({
      engine: 'natural',
      voiceId: 0,
    });
    expect(decodeNaturalVoice({ engine: 'system', voiceId: '1' })).toEqual({
      engine: 'system',
      voiceId: 0,
    });
  });
});

describe('speech voice preference', () => {
  it('defaults to the automatic voice at normal speed', () => {
    for (const value of [undefined, null, 'x', []]) {
      expect(decodeSpeechVoice(value)).toEqual({ voiceURI: null, rate: 1 });
    }
  });

  it('keeps a stored voice and clamps the rate', () => {
    expect(decodeSpeechVoice({ voiceURI: 'com.apple.Ava', rate: 1.1 })).toEqual({
      voiceURI: 'com.apple.Ava',
      rate: 1.1,
    });
    expect(decodeSpeechVoice({ voiceURI: '', rate: 9 })).toEqual({ voiceURI: null, rate: 1.2 });
    expect(decodeSpeechVoice({ rate: 'fast' }).rate).toBe(1);
  });
});
