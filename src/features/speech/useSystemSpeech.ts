import { useAtom } from '@effect/atom-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NATURAL_VOICES, naturalVoiceAtom, type VoiceEngineChoice } from '@/core/voice-preference';
import { prewarmNaturalVoice } from '@/lib/naturalVoice';
import type { StreamOptions } from './lib/speechStream';
import { createNaturalStream } from './naturalStream';
import { type SpeechState, usePlatformSpeech } from './usePlatformSpeech';
import { getPreferredVoice } from './voices';

export type { SpeechState } from './usePlatformSpeech';

type NaturalAvailability = 'loading' | 'ready' | 'unavailable';

/** Keeps the public speech controls identical for conversation, recall and previews. */
export function useSystemSpeech() {
  const system = usePlatformSpeech();
  const [preference, setPreference] = useAtom(naturalVoiceAtom);
  const [naturalAvailability, setNaturalAvailability] = useState<NaturalAvailability>('loading');
  const [naturalState, setNaturalState] = useState<SpeechState | null>(null);
  const streamRef = useRef<ReturnType<typeof createNaturalStream> | null>(null);
  const mounted = useRef(false);
  const warming = useRef<Promise<boolean> | null>(null);
  const retryNaturalVoice = useCallback(() => {
    setNaturalAvailability('loading');
    warming.current ??= prewarmNaturalVoice();
    void warming.current
      .then((ready) => {
        if (mounted.current) setNaturalAvailability(ready ? 'ready' : 'unavailable');
      })
      .catch(() => {
        // The voice choice stays saved; a system voice answers while local speech is unavailable.
        if (mounted.current) setNaturalAvailability('unavailable');
      })
      .finally(() => {
        warming.current = null;
      });
  }, []);
  useEffect(() => {
    mounted.current = true;
    retryNaturalVoice();
    return () => {
      mounted.current = false;
      streamRef.current?.stop();
      streamRef.current = null;
    };
  }, [retryNaturalVoice]);
  const stop = () => {
    streamRef.current?.stop();
    streamRef.current = null;
    setNaturalState(null);
    system.stop();
  };
  const beginStream = (options: StreamOptions = {}) => {
    stop();
    if (preference.engine !== 'natural' || naturalAvailability !== 'ready')
      return system.beginStream(options);
    const fallbackVoice =
      system.voices.find((option) => option.voice.voiceURI === system.selectedVoiceURI)?.voice ??
      getPreferredVoice(system.voices.map((option) => option.voice));
    const stream = createNaturalStream({
      voiceId: preference.voiceId,
      rate: system.rate,
      fallbackVoice,
      callbacks: options,
      onState: (state) => {
        if (mounted.current && streamRef.current === stream) setNaturalState(state);
      },
      onFallback: () => {
        if (mounted.current) retryNaturalVoice();
      },
    });
    streamRef.current = stream;
    return stream;
  };
  const play = (
    text: string,
    onStart?: (latencyMs: number) => void,
    onEnd?: () => void,
    voiceURI?: string,
  ) => {
    stop();
    if (voiceURI && !voiceURI.startsWith('natural:')) {
      system.play(text, onStart, onEnd, voiceURI);
      return;
    }
    if (preference.engine !== 'natural' || naturalAvailability !== 'ready') {
      system.play(text, onStart, onEnd);
      return;
    }
    // First-run previews pass the just-picked voice explicitly before React renders the preference.
    const voiceId =
      NATURAL_VOICES.find((voice) => `natural:${voice.id}` === voiceURI)?.id ?? preference.voiceId;
    const fallbackVoice = getPreferredVoice(system.voices.map((option) => option.voice));
    const stream = createNaturalStream({
      voiceId,
      rate: system.rate,
      fallbackVoice,
      callbacks: { onStart, onEnd },
      onState: (state) => {
        if (mounted.current && streamRef.current === stream) setNaturalState(state);
      },
      onFallback: () => {
        if (mounted.current) retryNaturalVoice();
      },
    });
    streamRef.current = stream;
    stream.finish(text);
  };
  const selectVoice = (voiceURI: string) => {
    const natural = NATURAL_VOICES.find((voice) => `natural:${voice.id}` === voiceURI);
    if (natural) setPreference({ engine: 'natural', voiceId: natural.id });
    else {
      setPreference({ ...preference, engine: 'system' });
      system.selectVoice(voiceURI);
    }
  };
  const setEngine = (engine: VoiceEngineChoice) => {
    stop();
    setPreference({ ...preference, engine });
  };
  return {
    ...system,
    state: naturalState ?? system.state,
    engine: preference.engine,
    setEngine,
    naturalAvailability,
    retryNaturalVoice,
    naturalVoices: NATURAL_VOICES,
    naturalVoiceId: preference.voiceId,
    selectedVoiceURI:
      preference.engine === 'natural' && naturalAvailability === 'ready'
        ? `natural:${preference.voiceId}`
        : system.selectedVoiceURI,
    selectVoice,
    play,
    beginStream,
    stop,
    pause: () => {
      if (streamRef.current && naturalState?.tag === 'speaking') streamRef.current.pause();
      else system.pause();
    },
    resume: () => {
      if (streamRef.current && naturalState?.tag === 'paused') streamRef.current.resume();
      else system.resume();
    },
  };
}
