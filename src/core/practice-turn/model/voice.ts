import type { AtomRegistry } from 'effect/reactivity';
import { captureTimingAtom } from '@/core/answer-capture';
import type { SessionDetails } from '@/core/practice-session';
import { createPlayback } from '@/core/speech';
import {
  generationAtom,
  replyEndedAtom,
  replyTimingAtom,
  replyVoiceAtom,
  voiceErrorAtom,
} from './state';

export const VOICE_FAILED_MESSAGE =
  'Eva’s voice could not play. The reply stays on screen; try Hear it or continue speaking.';

export type ReplyVoice = {
  readonly append: (text: string) => void;
  readonly finish: (text: string) => void;
  readonly cancel: () => void;
};

type VoiceContext = {
  readonly session: SessionDetails;
  readonly generation: number;
  readonly sentAtMs: number;
  readonly speechStoppedAtMs: number | undefined;
};

function endsMistakePractice(session: SessionDetails): boolean {
  return session.isMistakePractice && session.turnCount + 1 >= session.targetTurns;
}

export function beginReplyVoice(
  registry: AtomRegistry.AtomRegistry,
  context: VoiceContext,
): ReplyVoice {
  const { session, generation, sentAtMs, speechStoppedAtMs } = context;
  registry.set(replyTimingAtom, { ...registry.get(captureTimingAtom) });
  registry.set(voiceErrorAtom, '');
  function isCurrent() {
    return registry.get(generationAtom) === generation;
  }
  const handle = createPlayback(registry).beginStream({
    onStart: (latencyMs) => {
      if (!isCurrent()) return;
      const audioAtMs = performance.now();
      registry.update(replyTimingAtom, (timing) => ({
        ...timing,
        ttsStartMs: latencyMs,
        firstAiAudioMs: speechStoppedAtMs === undefined ? undefined : audioAtMs - speechStoppedAtMs,
        sendToAudioMs: audioAtMs - sentAtMs,
      }));
    },
    onError: () => registry.set(voiceErrorAtom, VOICE_FAILED_MESSAGE),
    onEnd: () => {
      if (!endsMistakePractice(session)) registry.set(replyEndedAtom, generation);
    },
  });
  registry.set(replyVoiceAtom, handle);
  let firstTokenSeen = false;
  return {
    append: (text) => {
      if (!firstTokenSeen) {
        firstTokenSeen = true;
        const firstTokenMs = performance.now() - sentAtMs;
        registry.update(replyTimingAtom, (timing) => ({ ...timing, firstTokenMs }));
      }
      handle.append(text);
    },
    finish: (text) => {
      const providerCompleteMs = performance.now() - sentAtMs;
      registry.update(replyTimingAtom, (timing) => ({ ...timing, providerCompleteMs }));
      handle.finish(text);
    },
    cancel: () => handle.cancel(),
  };
}
