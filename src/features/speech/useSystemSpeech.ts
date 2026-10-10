import { useEffect, useRef, useState } from 'react';
import {
  appendSpeechDelta,
  createSpeechStreamState,
  finishSpeechStream,
  type StreamHandle,
  type StreamOptions,
} from './lib/speechStream';
import type { StreamSession } from './speechStreamEdge';
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
  const activeStream = useRef<StreamSession | null>(null);
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
      activeStream.current = null;
      synthesis.removeEventListener('voiceschanged', refreshVoices);
      synthesis.cancel();
    };
  }, []);
  const invalidateCurrent = (cancelSynthesis: boolean) => {
    generation.current += 1;
    activeStream.current = null;
    if (cancelSynthesis && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  };
  const getSpeechSetup = (voiceURI?: string) => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setState({ tag: 'unavailable', reason: 'unsupported' });
      return null;
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
      return null;
    }
    setVoices(availableVoices);
    setSelectedVoiceURI(voice.voiceURI);
    return { synthesis, voice };
  };
  const isCurrentStream = (session: StreamSession) =>
    activeStream.current === session && generation.current === session.generation;

  const failStream = (session: StreamSession) => {
    const shouldNotify = !session.didError;
    session.didError = true;
    session.queue = [];
    session.isSpeaking = false;
    activeStream.current = null;
    generation.current += 1;
    setState({ tag: 'error', reason: 'playback-failed' });
    if (shouldNotify) session.options.onError?.();
  };
  const settleStreamQueue = (session: StreamSession) => {
    if (session.isFinished && !session.didEnd) {
      session.didEnd = true;
      activeStream.current = null;
      setState({ tag: 'idle' });
      session.options.onEnd?.();
      return;
    }
    if (!session.isFinished) setState({ tag: 'idle' });
  };
  const play = (
    text: string,
    onStart?: (latencyMs: number) => void,
    onEnd?: () => void,
    voiceURI?: string,
  ) => {
    const cleanText = text.trim();
    if (!cleanText) {
      invalidateCurrent(true);
      setState({ tag: 'error', reason: 'empty-text' });
      return;
    }
    invalidateCurrent(true);
    const setup = getSpeechSetup(voiceURI);
    if (!setup) return;
    const currentGeneration = generation.current;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = setup.voice;
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
      setup.synthesis.speak(utterance);
    } catch {
      if (isMounted.current && generation.current === currentGeneration) {
        setState({ tag: 'error', reason: 'playback-failed' });
      }
    }
  };
  const pumpStream = (session: StreamSession) => {
    if (!isCurrentStream(session) || session.isSpeaking) return;
    const nextText = session.queue.shift();
    if (!nextText) {
      settleStreamQueue(session);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.voice = session.voice;
    utterance.rate = session.rate;
    const speakCalledAt = performance.now();
    session.isSpeaking = true;
    setState({ tag: 'starting' });
    utterance.onstart = () => {
      if (!isCurrentStream(session)) return;
      setState({ tag: 'speaking' });
      if (!session.didStart) {
        session.didStart = true;
        session.options.onStart?.(performance.now() - speakCalledAt);
      }
    };
    utterance.onend = () => {
      if (!isCurrentStream(session)) return;
      session.isSpeaking = false;
      pumpStream(session);
    };
    utterance.onerror = () => {
      if (!isCurrentStream(session)) return;
      failStream(session);
    };
    try {
      session.synthesis.speak(utterance);
    } catch {
      if (!isCurrentStream(session)) return;
      failStream(session);
    }
  };
  const beginStream = (options: StreamOptions = {}): StreamHandle => {
    invalidateCurrent(true);
    const setup = getSpeechSetup();
    let didInitialError = false;
    const notifyInitialError = () => {
      if (didInitialError) return;
      didInitialError = true;
      options.onError?.();
    };
    if (!setup) {
      notifyInitialError();
      return { append: () => undefined, finish: () => undefined, cancel: () => undefined };
    }

    const session: StreamSession = {
      generation: generation.current,
      synthesis: setup.synthesis,
      voice: setup.voice,
      rate: clampSpeechRate(rate),
      options,
      queue: [],
      stream: createSpeechStreamState(),
      isSpeaking: false,
      isFinished: false,
      didStart: false,
      didError: false,
      didEnd: false,
    };
    activeStream.current = session;

    const handle: StreamHandle = {
      append: (delta) => {
        if (activeStream.current !== session || session.isFinished || session.didError) return;
        const result = appendSpeechDelta(session.stream, delta);
        session.stream = result.state;
        session.queue.push(...result.utterances);
        pumpStream(session);
      },
      finish: (finalText) => {
        if (activeStream.current !== session || session.isFinished || session.didError) return;
        const result = finishSpeechStream(session.stream, finalText);
        session.stream = result.state;
        session.isFinished = true;
        session.queue.push(...result.utterances);
        if (session.queue.length === 0 && !session.isSpeaking && !session.didStart) {
          session.didError = true;
          activeStream.current = null;
          setState({ tag: 'error', reason: 'empty-text' });
          notifyInitialError();
          return;
        }
        pumpStream(session);
      },
      cancel: () => {
        if (activeStream.current !== session) return;
        invalidateCurrent(true);
        setState({ tag: 'idle' });
      },
    };
    return handle;
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
    invalidateCurrent(true);
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
    beginStream,
    pause,
    resume,
    stop,
  };
}
