import { RegistryContext, useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import { useContext } from 'react';
import { NATURAL_VOICES, naturalVoiceAtom, speechVoiceAtom } from '@/core/voice-preference';
import { naturalVoiceIdOf, naturalVoiceURI, resolveSystemVoiceURI } from '../helpers/engine-choice';
import { naturalAvailability } from '../helpers/natural-availability';
import { appendDelta, finishReply, startReplyLog } from '../helpers/reply-log';
import { clampSpeechRate, getVoiceOptions } from '../helpers/system-voices';
import type { StreamHandle, StreamOptions } from '../types';
import {
  naturalAvailabilityAtom,
  pauseSpeechAtom,
  replyLogAtom,
  resumeSpeechAtom,
  speakAtom,
  speechStateAtom,
  systemVoicesAtom,
} from './atoms';
import { chooseEngineNow, rateNow } from './speech-snapshot';

const NO_HANDLE: StreamHandle = {
  append: () => undefined,
  finish: () => undefined,
  cancel: () => undefined,
};

let lastStreamId = 0;

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
  const setState = useAtomSet(speechStateAtom);
  const speak = useAtomSet(speakAtom);
  const setReplyLog = useAtomSet(replyLogAtom);
  const pauseNow = useAtomSet(pauseSpeechAtom);
  const resumeNow = useAtomSet(resumeSpeechAtom);

  function stop() {
    speak(Atom.Interrupt);
    setState({ tag: 'idle' });
  }

  function beginStream(options: StreamOptions = {}, voiceURI?: string): StreamHandle {
    stop();
    const engine = chooseEngineNow(registry, voiceURI);
    if (engine === null) {
      setState({ tag: 'error', reason: 'voices-unavailable' });
      options.onError?.();
      return NO_HANDLE;
    }
    lastStreamId += 1;
    const streamId = lastStreamId;
    setReplyLog(startReplyLog(streamId));
    speak({ streamId, engine, rate: rateNow(registry), options });
    return {
      append: (delta) => setReplyLog((log) => appendDelta(log, streamId, delta)),
      finish: (finalText) => setReplyLog((log) => finishReply(log, streamId, finalText)),
      cancel: () => {
        if (lastStreamId === streamId) stop();
      },
    };
  }

  function play(
    text: string,
    onStart?: (latencyMs: number) => void,
    onEnd?: () => void,
    voiceURI?: string,
  ) {
    beginStream({ onStart, onEnd }, voiceURI).finish(text);
  }

  return {
    state,
    stop,
    beginStream,
    play,
    pause: () => {
      if (registry.get(speechStateAtom).tag === 'speaking') pauseNow(undefined);
    },
    resume: () => {
      if (registry.get(speechStateAtom).tag === 'paused') resumeNow(undefined);
    },
  };
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

export type SpeechControls = ReturnType<typeof useSpeech>;
