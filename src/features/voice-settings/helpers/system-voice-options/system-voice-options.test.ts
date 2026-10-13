import { describe, expect, it } from 'bun:test';
import { systemVoiceOptions } from './index';

describe('systemVoiceOptions', () => {
  it('labels a voice with its language and marks the ones that are not English', () => {
    expect(
      systemVoiceOptions([
        { voiceURI: 'ava', name: 'Ava', lang: 'en-US', isEnglish: true },
        { voiceURI: 'anna', name: 'Anna', lang: 'de-DE', isEnglish: false },
      ]),
    ).toEqual([
      { value: 'ava', label: 'Ava (en-US)' },
      { value: 'anna', label: 'Anna (de-DE) · not English' },
    ]);
  });
});
