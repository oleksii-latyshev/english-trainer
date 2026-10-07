import { useEffect, useRef, useState } from 'react';
import { voicePreference } from './voicePreferences';
import { clampSpeechRate, getPreferredVoice, getVoiceOptions } from './voices';

export type SpeechState =
  | { tag: 'unavailable'; reason: 'unsupported' }
  | { tag: 'idle' }
  | { tag: 'starting' }
  | { tag: 'speaking' }
  | { tag: 'paused' }
  | { tag: 'error'; reason: 'empty-text' | 'voices-unavailable' | 'playback-failed' };

export function useSystemSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // The saved choice survives restarts; an unavailable voice falls back below without erasing it.
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(
    () => voicePreference.get().voiceURI,
  );
  const [rate, setRateState] = useState(() => voicePreference.get().rate);
  const [state, setState] = useState<SpeechState>({ tag: 'idle' });
  const generation = useRef(0);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setState({ tag: 'unavailable', reason: 'unsupported' });
      return () => {
        isMounted.current = false;
      };
    }

    const synthesis = window.speechSynthesis;
    const refreshVoices = () => {
      if (!isMounted.current) return;
      const discovered = synthesis.getVoices();
      // The list is empty until macOS has loaded it; keep the saved choice meanwhile.
      if (discovered.length === 0) return;
      setVoices(discovered);
      setSelectedVoiceURI((current) => {
        if (current && discovered.some((voice) => voice.voiceURI === current)) return current;
        return getPreferredVoice(discovered)?.voiceURI ?? null;
      });
    };

    refreshVoices();
    synthesis.addEventListener('voiceschanged', refreshVoices);
    return () => {
      isMounted.current = false;
      generation.current += 1;
      synthesis.removeEventListener('voiceschanged', refreshVoices);
      synthesis.cancel();
    };
  }, []);

  /**
   * `onEnd` runs only when the utterance finishes by itself, not on stop, cancel or error.
   * `voiceURI` speaks this one line in that voice (for a sample, before the choice has settled).
   */
  const play = (
    text: string,
    onStart?: (latencyMs: number) => void,
    onEnd?: () => void,
    voiceURI?: string,
  ) => {
    const cleanText = text.trim();
    if (!cleanText) {
      setState({ tag: 'error', reason: 'empty-text' });
      return;
    }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setState({ tag: 'unavailable', reason: 'unsupported' });
      return;
    }

    const synthesis = window.speechSynthesis;
    const availableVoices = synthesis.getVoices();
    const wantedVoiceURI = voiceURI ?? selectedVoiceURI;
    const voice =
      availableVoices.find((candidate) => candidate.voiceURI === wantedVoiceURI) ??
      getPreferredVoice(availableVoices);
    if (!voice) {
      setVoices([]);
      setSelectedVoiceURI(null);
      setState({ tag: 'error', reason: 'voices-unavailable' });
      return;
    }
    setVoices(availableVoices);
    setSelectedVoiceURI(voice.voiceURI);

    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = voice;
    utterance.rate = clampSpeechRate(rate);
    const startedAt = performance.now();
    utterance.onstart = () => {
      if (isMounted.current && generation.current === currentGeneration) {
        setState({ tag: 'speaking' });
        onStart?.(performance.now() - startedAt);
      }
    };
    utterance.onend = () => {
      if (isMounted.current && generation.current === currentGeneration) {
        setState({ tag: 'idle' });
        onEnd?.();
      }
    };
    utterance.onerror = () => {
      if (isMounted.current && generation.current === currentGeneration) {
        setState({ tag: 'error', reason: 'playback-failed' });
      }
    };
    setState({ tag: 'starting' });
    try {
      synthesis.speak(utterance);
    } catch {
      if (isMounted.current && generation.current === currentGeneration) {
        setState({ tag: 'error', reason: 'playback-failed' });
      }
    }
  };

  const pause = () => {
    if (!('speechSynthesis' in window) || state.tag !== 'speaking') return;
    window.speechSynthesis.pause();
    setState({ tag: 'paused' });
  };

  const resume = () => {
    if (!('speechSynthesis' in window) || state.tag !== 'paused') return;
    window.speechSynthesis.resume();
    setState({ tag: 'speaking' });
  };

  const stop = () => {
    if (!('speechSynthesis' in window)) return;
    generation.current += 1;
    window.speechSynthesis.cancel();
    setState({ tag: 'idle' });
  };

  const selectVoice = (voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    voicePreference.set({ voiceURI });
  };

  const setRate = (nextRate: number) => {
    const clamped = clampSpeechRate(nextRate);
    setRateState(clamped);
    voicePreference.set({ rate: clamped });
  };
  const voiceOptions = getVoiceOptions(voices);

  return {
    state,
    voices: voiceOptions,
    selectedVoiceURI,
    selectVoice,
    rate,
    setRate,
    play,
    pause,
    resume,
    stop,
  };
}
