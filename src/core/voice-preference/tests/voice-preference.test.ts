import { expect, it } from 'bun:test';
import { AtomRegistry } from 'effect/reactivity';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { DEFAULT_SPEECH_VOICE } from '../voice-preference';

const stored = installFakeLocalStorage({
  english_trainer_natural_voice: JSON.stringify({ engine: 'system', voiceId: 6 }),
  english_trainer_voice: JSON.stringify({ voiceURI: 'com.apple.Ava', rate: 9 }),
});

it('reads values saved by an older version', async () => {
  const { naturalVoiceAtom, speechVoiceAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(naturalVoiceAtom)).toEqual({ engine: 'system', voiceId: 6 });
  expect(registry.get(speechVoiceAtom)).toEqual({ voiceURI: 'com.apple.Ava', rate: 1.2 });
});

it('persists a change in the stored shape', async () => {
  const { naturalVoiceAtom, speechVoiceAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  registry.set(naturalVoiceAtom, { engine: 'natural', voiceId: 9 });
  registry.set(speechVoiceAtom, { ...DEFAULT_SPEECH_VOICE, rate: 1.1 });
  expect(JSON.parse(stored.get('english_trainer_natural_voice') ?? '{}')).toEqual({
    engine: 'natural',
    voiceId: 9,
  });
  expect(JSON.parse(stored.get('english_trainer_voice') ?? '{}').rate).toBe(1.1);
});

it('lets non-React code read the value the atoms hold', async () => {
  const { appRegistry } = await import('@/core/runtime');
  const { naturalVoiceAtom } = await import('../model/atoms');
  const { readNaturalVoice } = await import('../model/read-voice-preference');
  appRegistry.set(naturalVoiceAtom, { engine: 'natural', voiceId: 3 });
  expect(readNaturalVoice().voiceId).toBe(3);
});
