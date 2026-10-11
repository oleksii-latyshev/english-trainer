// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test';
import { parseNaturalVoicePreference } from './naturalVoicePreference';

test('local voice defaults and stored choices are parsed without changing system voice preferences', () => {
  expect(parseNaturalVoicePreference(null)).toEqual({ engine: 'natural', voiceId: 0 });
  expect(parseNaturalVoicePreference({ engine: 'system', voiceId: 5 })).toEqual({
    engine: 'system',
    voiceId: 5,
  });
  expect(parseNaturalVoicePreference({ engine: 'cloud', voiceId: 999 })).toEqual({
    engine: 'natural',
    voiceId: 0,
  });
  expect(parseNaturalVoicePreference({ engine: 'natural', voiceId: '1' }).voiceId).toBe(0);
});
