import { useEffect, useRef, useState } from 'react';
import { clampSpeechRate, getPreferredVoice, getVoiceOptions } from './voices';

export type SpeechState =
  | { tag: 'unavailable'; reason: 'unsupported' }
  | { tag: 'idle' }
  | { tag: 'speaking' }
  | { tag: 'paused' }
  | { tag: 'error'; reason: 'empty-text' | 'voices-unavailable' | 'playback-failed' };

export function useSystemSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
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

  const play = (text: string) => {
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
    const voice =
      availableVoices.find((candidate) => candidate.voiceURI === selectedVoiceURI) ??
      getPreferredVoice(availableVoices);
    if (!voice) {
      setVoices([]);
      setState({ tag: 'error', reason: 'voices-unavailable' });
      return;
    }

    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = voice;
    utterance.rate = clampSpeechRate(rate);
    utterance.onstart = () => {
      if (isMounted.current && generation.current === currentGeneration)
        setState({ tag: 'speaking' });
    };
    utterance.onend = () => {
      if (isMounted.current && generation.current === currentGeneration) setState({ tag: 'idle' });
    };
    utterance.onerror = () => {
      if (isMounted.current && generation.current === currentGeneration) {
        setState({ tag: 'error', reason: 'playback-failed' });
      }
    };
    setState({ tag: 'speaking' });
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

  const setRate = (nextRate: number) => setRateState(clampSpeechRate(nextRate));
  const voiceOptions = getVoiceOptions(voices);

  return {
    state,
    voices: voiceOptions,
    selectedVoiceURI,
    selectVoice: setSelectedVoiceURI,
    rate,
    setRate,
    play,
    pause,
    resume,
    stop,
  };
}
