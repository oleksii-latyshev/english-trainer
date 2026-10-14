import { Atom, type AtomRegistry } from 'effect/reactivity';
import { appendDelta, finishReply, startReplyLog } from '../helpers/reply-log';
import type { StreamHandle, StreamOptions } from '../types';
import {
  pauseSpeechAtom,
  replyLogAtom,
  resumeSpeechAtom,
  speakAtom,
  speechStateAtom,
} from './atoms';
import { chooseEngineNow, rateNow } from './speech-snapshot';

const NO_HANDLE: StreamHandle = {
  append: () => undefined,
  finish: () => undefined,
  cancel: () => undefined,
};

let lastStreamId = 0;

export function createPlayback(registry: AtomRegistry.AtomRegistry) {
  function stop() {
    registry.set(speakAtom, Atom.Interrupt);
    registry.set(speechStateAtom, { tag: 'idle' });
  }

  function beginStream(options: StreamOptions = {}, voiceURI?: string): StreamHandle {
    stop();
    const engine = chooseEngineNow(registry, voiceURI);
    if (engine === null) {
      registry.set(speechStateAtom, { tag: 'error', reason: 'voices-unavailable' });
      options.onError?.();
      return NO_HANDLE;
    }
    lastStreamId += 1;
    const streamId = lastStreamId;
    registry.set(replyLogAtom, startReplyLog(streamId));
    registry.set(speakAtom, { streamId, engine, rate: rateNow(registry), options });
    return {
      append: (delta) =>
        registry.set(replyLogAtom, appendDelta(registry.get(replyLogAtom), streamId, delta)),
      finish: (finalText) =>
        registry.set(replyLogAtom, finishReply(registry.get(replyLogAtom), streamId, finalText)),
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
    stop,
    beginStream,
    play,
    pause: () => {
      if (registry.get(speechStateAtom).tag === 'speaking')
        registry.set(pauseSpeechAtom, undefined);
    },
    resume: () => {
      if (registry.get(speechStateAtom).tag === 'paused') registry.set(resumeSpeechAtom, undefined);
    },
  };
}

export type Playback = ReturnType<typeof createPlayback>;
