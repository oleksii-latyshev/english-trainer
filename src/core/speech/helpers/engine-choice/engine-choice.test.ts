import { describe, expect, test } from 'bun:test';
import { chooseEngine, type EngineInputs, naturalVoiceIdOf, resolveSystemVoiceURI } from './index';

const ENGLISH = { lang: 'en-US', voiceURI: 'samantha', name: 'Samantha' };
const FRENCH = { lang: 'fr-FR', voiceURI: 'amelie', name: 'Amelie' };

function inputs(overrides: Partial<EngineInputs> = {}): EngineInputs {
  return {
    requestedVoiceURI: undefined,
    isNaturalReady: true,
    naturalVoiceId: 5,
    systemVoices: [ENGLISH],
    savedVoiceURI: null,
    ...overrides,
  };
}

describe('chooseEngine', () => {
  test('uses the saved natural voice when the local engine is ready', () => {
    expect(chooseEngine(inputs())).toEqual({
      kind: 'natural',
      voiceId: 5,
      fallbackVoiceURI: 'samantha',
    });
  });

  test('a preview of another natural voice overrides the saved one', () => {
    expect(chooseEngine(inputs({ requestedVoiceURI: 'natural:1' }))).toMatchObject({
      kind: 'natural',
      voiceId: 1,
    });
  });

  test('an explicitly requested system voice wins over the natural engine', () => {
    expect(
      chooseEngine(inputs({ requestedVoiceURI: 'amelie', systemVoices: [ENGLISH, FRENCH] })),
    ).toEqual({
      kind: 'system',
      voiceURI: 'amelie',
    });
  });

  test('uses the saved system voice while the natural engine is not ready', () => {
    const choice = chooseEngine(
      inputs({ isNaturalReady: false, systemVoices: [ENGLISH, FRENCH], savedVoiceURI: 'amelie' }),
    );

    expect(choice).toEqual({ kind: 'system', voiceURI: 'amelie' });
  });

  test('falls back to the preferred voice when the saved one is gone', () => {
    const choice = chooseEngine(inputs({ isNaturalReady: false, savedVoiceURI: 'removed' }));

    expect(choice).toEqual({ kind: 'system', voiceURI: 'samantha' });
  });

  test('has no engine when neither natural nor any system voice is available', () => {
    expect(chooseEngine(inputs({ isNaturalReady: false, systemVoices: [] }))).toBeNull();
  });

  test('natural speech works even before any system voice is listed', () => {
    expect(chooseEngine(inputs({ systemVoices: [] }))).toMatchObject({
      kind: 'natural',
      fallbackVoiceURI: null,
    });
  });
});

describe('natural voice URIs', () => {
  test('recognises the ids of the bundled voices only', () => {
    expect(naturalVoiceIdOf('natural:6')).toBe(6);
    expect(naturalVoiceIdOf('natural:42')).toBeUndefined();
    expect(naturalVoiceIdOf('samantha')).toBeUndefined();
    expect(naturalVoiceIdOf(undefined)).toBeUndefined();
  });
});

describe('resolveSystemVoiceURI', () => {
  test('keeps a saved voice that is still installed', () => {
    expect(resolveSystemVoiceURI([ENGLISH, FRENCH], 'amelie')).toBe('amelie');
  });

  test('has nothing to resolve without voices', () => {
    expect(resolveSystemVoiceURI([], 'amelie')).toBeNull();
  });
});
