import { isNaturalVoiceError, synthesizeNaturalVoice } from '@/lib/naturalVoice';
import { splitNaturalPhrases } from './lib/naturalPhrases';
import {
  appendSpeechDelta,
  createSpeechStreamState,
  finishSpeechStream,
  type StreamOptions,
} from './lib/speechStream';
import { type Playback, playSystemSentence, playWave } from './naturalPlayback';
import type { SpeechState } from './usePlatformSpeech';

type Sentence = { text: string; audio?: Promise<ArrayBuffer | null>; wasBusy?: boolean };
type Options = {
  voiceId: number;
  rate: number;
  fallbackVoice: SpeechSynthesisVoice | null;
  callbacks: StreamOptions;
  onState: (state: SpeechState) => void;
  onFallback: () => void;
};
/** One queued sentence ahead is rendered while the current sentence plays. */
export function createNaturalStream(options: Options) {
  let stream = createSpeechStreamState();
  const queue: Sentence[] = [];
  const pending = new Set<() => void>();
  let active = true;
  let finished = false;
  let didStart = false;
  let busy = false;
  let useSystem = false;
  let paused = false;
  let playback: Playback | null = null;
  const prepare = (sentence: Sentence) => {
    if (sentence.audio || useSystem) return;
    sentence.audio = new Promise<ArrayBuffer | null>((resolve) => {
      const settle = (bytes: ArrayBuffer | null) => {
        clearTimeout(timer);
        pending.delete(cancel);
        resolve(bytes);
      };
      const cancel = () => settle(null);
      const timer = setTimeout(cancel, 800);
      pending.add(cancel);
      // A failure is deliberately recoverable through the installed system voice.
      void synthesizeNaturalVoice(sentence.text, options.voiceId, options.rate)
        .then(settle)
        .catch((error: unknown) => {
          sentence.wasBusy = isNaturalVoiceError(error) && error.code === 'busy';
          settle(null);
        });
    });
  };
  const fail = () => {
    if (!active) return;
    active = false;
    for (const cancel of pending) cancel();
    queue.length = 0;
    playback?.stop();
    options.onState({ tag: 'error', reason: 'playback-failed' });
    options.callbacks.onError?.();
  };
  const settle = () => {
    if (!finished) {
      options.onState({ tag: 'idle' });
      return;
    }
    active = false;
    if (!didStart) {
      options.onState({ tag: 'error', reason: 'empty-text' });
      options.callbacks.onError?.();
      return;
    }
    options.onState({ tag: 'idle' });
    options.callbacks.onEnd?.();
  };
  const prefetch = () => {
    const next = queue[0];
    if (next) prepare(next);
  };
  const playbackCallbacks = (sentence: Sentence, startedAt: number) => {
    let sentenceStarted = false;
    const callbacks = {
      onStart: () => {
        if (!active) return;
        sentenceStarted = true;
        options.onState({ tag: 'speaking' });
        if (!didStart) {
          didStart = true;
          options.callbacks.onStart?.(performance.now() - startedAt);
        }
        // Inference starts after this request finishes, avoiding a backend queue/Busy error.
        prefetch();
      },
      onEnd: () => {
        if (!active) return;
        playback = null;
        busy = false;
        void pump();
      },
      onError: () => {
        if (!active) return;
        if (sentenceStarted || useSystem) {
          fail();
          return;
        }
        useSystem = true;
        options.onFallback();
        playback = playSystemSentence(
          sentence.text,
          options.fallbackVoice,
          options.rate,
          callbacks,
        );
      },
    };
    return callbacks;
  };
  const setPlayback = (next: Playback) => {
    playback = next;
    if (!paused) return;
    playback.pause();
    options.onState({ tag: 'paused' });
  };
  const fallback = (sentence: Sentence) => {
    if (useSystem) return;
    useSystem = true;
    if (!sentence.wasBusy) options.onFallback();
  };
  const pump = async () => {
    if (!active || busy || paused) return;
    const sentence = queue.shift();
    if (!sentence) {
      settle();
      return;
    }
    busy = true;
    const startedAt = performance.now();
    options.onState({ tag: 'starting' });
    prepare(sentence);
    const audio = useSystem ? null : await sentence.audio;
    if (!active) return;
    if (!audio) fallback(sentence);
    const callbacks = playbackCallbacks(sentence, startedAt);
    setPlayback(
      audio
        ? playWave(audio, callbacks)
        : playSystemSentence(sentence.text, options.fallbackVoice, options.rate, callbacks),
    );
  };
  const enqueue = (utterances: string[]) => {
    queue.push(...utterances.flatMap(splitNaturalPhrases).map((text) => ({ text })));
    // Later provider deltas may complete a sentence while audio is already playing.
    if (playback && !useSystem) prefetch();
    void pump();
  };
  const stop = () => {
    active = false;
    for (const cancel of pending) cancel();
    queue.length = 0;
    playback?.stop();
    playback = null;
  };
  return {
    append: (delta: string) => {
      if (!active || finished) return;
      const result = appendSpeechDelta(stream, delta);
      stream = result.state;
      enqueue(result.utterances);
    },
    finish: (finalText: string) => {
      if (!active || finished) return;
      const result = finishSpeechStream(stream, finalText);
      stream = result.state;
      finished = true;
      enqueue(result.utterances);
    },
    cancel: () => {
      if (!active) return;
      stop();
      options.onState({ tag: 'idle' });
    },
    stop,
    pause: () => {
      if (!active) return;
      paused = true;
      playback?.pause();
      options.onState({ tag: 'paused' });
    },
    resume: () => {
      if (!active || !paused) return;
      paused = false;
      if (playback) {
        playback.resume();
        options.onState({ tag: 'speaking' });
      } else void pump();
    },
  };
}
