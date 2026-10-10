import type { Page } from '@playwright/test';

export type StreamEdgeState = {
  spoken: string[];
  cancelled: number;
  providerFinished: boolean;
  firstSpeechAtMs: number | null;
  providerFinishedAtMs: number | null;
  finishSpeech: () => void;
  finishProvider: () => void;
};
declare global {
  interface Window {
    __ET_STREAM__: StreamEdgeState;
  }
}

/** Controlled provider/TTS edges expose real queue and interruption behavior without playing audio. */
export async function installStreamingFixture(
  page: Page,
  options: {
    holdVoice?: boolean;
    noDeltas?: boolean;
    warmMicrophone?: boolean;
    voiceError?: boolean;
    cancelDelayMs?: number;
    holdProvider?: boolean;
  } = {},
) {
  await page.addInitScript(
    (seed: {
      holdVoice?: boolean;
      noDeltas?: boolean;
      warmMicrophone?: boolean;
      voiceError?: boolean;
      cancelDelayMs?: number;
      holdProvider?: boolean;
    }) => {
      const edge: StreamEdgeState = {
        spoken: [],
        cancelled: 0,
        providerFinished: false,
        firstSpeechAtMs: null,
        providerFinishedAtMs: null,
        finishSpeech: () => {},
        finishProvider: () => {},
      };
      window.__ET_STREAM__ = edge;
      if (seed.warmMicrophone) {
        const retainedAudioContexts: AudioContext[] = [];
        navigator.mediaDevices.getUserMedia = async () => {
          window.__ET_AUDIO_COUNTS__.mediaRequests += 1;
          const context = new AudioContext();
          retainedAudioContexts.push(context);
          return context.createMediaStreamDestination().stream;
        };
      }
      const callbacks = new Map<number, (event: unknown) => void>();
      const internals = window.__TAURI_INTERNALS__;
      const register = internals.transformCallback;
      let suppressLegacyDelta = false;
      internals.transformCallback = (callback, once) => {
        const wrapped = (event: unknown) => {
          if (!suppressLegacyDelta) callback(event);
        };
        const id = register(wrapped, once);
        callbacks.set(id, callback);
        return id;
      };
      const original = internals.invoke;
      let requestEpoch = 0;
      let isPending = false;
      const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
      function channelId(value: unknown): number | undefined {
        if (typeof value === 'string' && value.startsWith('__CHANNEL__:'))
          return Number(value.slice(12));
        if (typeof value === 'object' && value !== null) {
          const id: unknown = Reflect.get(value, 'id');
          if (typeof id === 'number') return id;
        }
        return undefined;
      }
      internals.invoke = async (command, args = {}) => {
        if (command === 'cancel_practice_reply') {
          await delay(seed.cancelDelayMs ?? 0);
          window.__ET_HARNESS__.calls.push({ command, args });
          const cancelled = isPending;
          requestEpoch += 1;
          isPending = false;
          return cancelled;
        }
        if (command !== 'send_practice_turn') return original(command, args);
        return send(args);
      };
      async function send(args: Record<string, unknown>) {
        const epoch = ++requestEpoch;
        isPending = true;
        const id = channelId(args.onReply);
        const callback = id === undefined ? undefined : callbacks.get(id);
        await delay(60);
        if (!seed.noDeltas)
          callback?.({ index: 0, message: { kind: 'delta', text: 'That sounds useful.' } });
        if (seed.holdProvider) {
          await new Promise<void>((resolve) => {
            edge.finishProvider = resolve;
          });
        } else await delay(700);
        // A deliberately late event exercises the UI generation guard even after cancellation.
        if (!seed.noDeltas)
          callback?.({ index: 1, message: { kind: 'delta', text: ' How did you choose it?' } });
        if (epoch !== requestEpoch) throw { code: 'cancelled', message: 'Reply interrupted.' };
        suppressLegacyDelta = true;
        try {
          const result = await original('send_practice_turn', args);
          edge.providerFinished = true;
          edge.providerFinishedAtMs = performance.now();
          return result;
        } finally {
          suppressLegacyDelta = false;
          isPending = false;
        }
      }
      let current: SpeechSynthesisUtterance | null = null;
      const synthesis = window.speechSynthesis;
      const cancel = synthesis.cancel.bind(synthesis);
      synthesis.cancel = () => {
        edge.cancelled += 1;
        current = null;
        cancel();
      };
      function finishUtterance(utterance: SpeechSynthesisUtterance) {
        if (current !== utterance) return;
        current = null;
        const onEnd: unknown = Reflect.get(utterance, 'onend');
        if (typeof onEnd === 'function') onEnd();
      }
      function failUtterance(utterance: SpeechSynthesisUtterance) {
        current = null;
        const onError: unknown = Reflect.get(utterance, 'onerror');
        if (typeof onError === 'function') onError();
      }
      function startUtterance(utterance: SpeechSynthesisUtterance) {
        edge.firstSpeechAtMs ??= performance.now();
        const onStart: unknown = Reflect.get(utterance, 'onstart');
        if (typeof onStart === 'function') onStart();
        if (!seed.holdVoice) queueMicrotask(() => finishUtterance(utterance));
      }
      function scheduleUtterance(utterance: SpeechSynthesisUtterance) {
        queueMicrotask(() => {
          if (current !== utterance) return;
          if (seed.voiceError) {
            failUtterance(utterance);
            return;
          }
          startUtterance(utterance);
        });
      }
      synthesis.speak = (utterance) => {
        window.__ET_AUDIO_COUNTS__.speechRequests += 1;
        edge.spoken.push(utterance.text);
        current = utterance;
        edge.finishSpeech = () => finishUtterance(utterance);
        scheduleUtterance(utterance);
      };
    },
    options,
  );
}
