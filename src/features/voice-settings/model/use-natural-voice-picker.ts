import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  naturalAvailability,
  naturalAvailabilityAtom,
  previewingNaturalVoiceAtom,
  previewNaturalVoiceAtom,
} from '@/core/speech';
import {
  type NaturalVoiceId,
  naturalVoiceAtom,
  speechVoiceAtom,
  type VoiceEngineChoice,
} from '@/core/voice-preference';
import { VOICE_SAMPLE, voiceIdFromOption } from '../helpers/voice-options';

export function useNaturalVoicePicker() {
  const [natural, setNatural] = useAtom(naturalVoiceAtom);
  const [speech, setSpeech] = useAtom(speechVoiceAtom);
  const availability = naturalAvailability(useAtomValue(naturalAvailabilityAtom));
  const retry = useAtomRefresh(naturalAvailabilityAtom);
  const preview = useAtomSet(previewNaturalVoiceAtom);
  const previewResult = useAtomValue(previewNaturalVoiceAtom);
  const previewing = useAtomValue(previewingNaturalVoiceAtom);

  function playSample(voiceId: NaturalVoiceId) {
    preview({ text: VOICE_SAMPLE, voiceId, rate: speech.rate });
  }

  function stopPreview() {
    preview(Atom.Interrupt);
  }

  function setEngine(engine: VoiceEngineChoice) {
    stopPreview();
    setNatural({ ...natural, engine });
  }

  function selectVoice(value: string) {
    const voiceId = voiceIdFromOption(value);
    if (voiceId === undefined) return;
    setNatural({ engine: 'natural', voiceId });
    playSample(voiceId);
  }

  function togglePreview(value: string) {
    const voiceId = voiceIdFromOption(value);
    if (voiceId === undefined) return;
    if (previewing === voiceId) stopPreview();
    else playSample(voiceId);
  }

  function setRate(rate: number) {
    setSpeech({ ...speech, rate });
  }

  return {
    natural,
    rate: speech.rate,
    availability,
    previewing,
    previewFailed: AsyncResult.isFailure(previewResult),
    retry,
    stopPreview,
    setEngine,
    selectVoice,
    togglePreview,
    setRate,
  };
}
