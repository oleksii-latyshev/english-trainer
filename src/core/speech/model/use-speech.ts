import { RegistryContext, useAtom, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { NATURAL_VOICES, naturalVoiceAtom, speechVoiceAtom } from '@/core/voice-preference';
import { naturalVoiceIdOf, naturalVoiceURI, resolveSystemVoiceURI } from '../helpers/engine-choice';
import { naturalAvailability } from '../helpers/natural-availability';
import { clampSpeechRate, getVoiceOptions } from '../helpers/system-voices';
import { naturalAvailabilityAtom, speechStateAtom, systemVoicesAtom } from './atoms';
import { createPlayback } from './playback';

function useVoiceChoice() {
  const [natural, setNatural] = useAtom(naturalVoiceAtom);
  const [preference, setPreference] = useAtom(speechVoiceAtom);
  const availability = naturalAvailability(useAtomValue(naturalAvailabilityAtom));
  const voicesResult = useAtomValue(systemVoicesAtom);
  const systemVoices = AsyncResult.isSuccess(voicesResult) ? voicesResult.value : [];
  const isNaturalReady = natural.engine === 'natural' && availability === 'ready';
  const resolvedURI = resolveSystemVoiceURI(systemVoices, preference.voiceURI);

  function selectVoice(voiceURI: string) {
    const naturalId = naturalVoiceIdOf(voiceURI);
    if (naturalId !== undefined) {
      setNatural({ engine: 'natural', voiceId: naturalId });
      return;
    }
    setNatural((current) => ({ ...current, engine: 'system' }));
    setPreference((current) => ({ ...current, voiceURI }));
  }

  function setRate(rate: number) {
    setPreference((current) => ({ ...current, rate: clampSpeechRate(rate) }));
  }

  return {
    systemVoices,
    voices: getVoiceOptions([...systemVoices]),
    rate: clampSpeechRate(preference.rate),
    selectedVoiceURI: isNaturalReady
      ? naturalVoiceURI(natural.voiceId)
      : (resolvedURI ?? preference.voiceURI),
    engine: natural.engine,
    availability,
    selectVoice,
    setRate,
  };
}

function useSpeechPlayback() {
  const registry = useContext(RegistryContext);
  const state = useAtomValue(speechStateAtom);
  return { state, ...createPlayback(registry) };
}

export function useSpeech() {
  const choice = useVoiceChoice();
  const playback = useSpeechPlayback();
  return {
    ...playback,
    voices: choice.voices,
    selectedVoiceURI: choice.selectedVoiceURI,
    selectVoice: choice.selectVoice,
    rate: choice.rate,
    setRate: choice.setRate,
    engine: choice.engine,
    naturalAvailability: choice.availability,
    naturalVoices: NATURAL_VOICES,
  };
}
