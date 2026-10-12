import { describe, expect, it } from 'bun:test';
import { VOICE_OPTIONS, voiceIdFromOption } from './index';

describe('voice options', () => {
  it('lists every voice of the bundled model with its gender', () => {
    expect(VOICE_OPTIONS).toHaveLength(10);
    expect(VOICE_OPTIONS.slice(0, 5).every((voice) => voice.description.startsWith('Female'))).toBe(
      true,
    );
    expect(VOICE_OPTIONS.slice(5).every((voice) => voice.description.startsWith('Male'))).toBe(
      true,
    );
    expect(new Set(VOICE_OPTIONS.map((voice) => voice.label)).size).toBe(10);
  });

  it('maps an option back to its voice id', () => {
    expect(voiceIdFromOption('7')).toBe(7);
    expect(voiceIdFromOption('10')).toBeUndefined();
  });
});
