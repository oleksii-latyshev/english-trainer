import type { Page } from '@playwright/test';
import type { RescueKind, RescueRequest, RescueResponse } from '../src/lib/rescueTypes';

export type RescueFixtureOptions = {
  failFirst?: boolean;
  failKindOnce?: RescueKind;
  delayMs?: number;
  delayFirstMs?: number;
  noSpeech?: boolean;
  handsFree?: boolean;
  autoListen?: boolean;
  silentMicrophone?: boolean;
};
type RescueEdge = {
  requests: RescueRequest[];
  snapshots: number;
  completed: number;
  finalTranscriptions: number;
};
declare global {
  interface Window {
    __ET_RESCUE__: RescueEdge;
  }
}

/** Provider/STT IPC is faked while a live oscillator feeds the app's real PCM capture path. */
export async function installRescueFixture(page: Page, options: RescueFixtureOptions = {}) {
  await page.addInitScript((seed: RescueFixtureOptions) => {
    if (seed.handsFree || seed.autoListen) {
      window.localStorage.setItem(
        'english_trainer_conversation_flow',
        JSON.stringify({
          autoListen: seed.autoListen ?? false,
          handsFree: seed.handsFree ?? false,
          endPauseMs: 1500,
          autoSendVoice: false,
          autoSendDelayMs: 2000,
        }),
      );
    }
    const edge: RescueEdge = { requests: [], snapshots: 0, completed: 0, finalTranscriptions: 0 };
    window.__ET_RESCUE__ = edge;
    const retainedAudioContexts: AudioContext[] = [];
    // A synthetic microphone must obey Chromium's Web Audio activation policy too.
    const activated = new Promise<void>((resolve) => {
      function onActivation(event: Event) {
        if (!event.isTrusted) return;
        window.removeEventListener('pointerdown', onActivation, true);
        window.removeEventListener('keydown', onActivation, true);
        resolve();
      }
      window.addEventListener('pointerdown', onActivation, true);
      window.addEventListener('keydown', onActivation, true);
    });
    navigator.mediaDevices.getUserMedia = async () => {
      window.__ET_AUDIO_COUNTS__.mediaRequests += 1;
      if (!navigator.userActivation.hasBeenActive) await activated;
      const context = new AudioContext();
      retainedAudioContexts.push(context);
      const destination = context.createMediaStreamDestination();
      if (!seed.silentMicrophone) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 220;
        gain.gain.value = 0.12;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
      }
      await context.resume();
      return destination.stream;
    };
    const original = window.__TAURI_INTERNALS__.invoke;
    const failedKinds = new Set<RescueKind>();
    const current = (sessionId: unknown, sequence: unknown) => {
      const active = window.__ET_HARNESS__.activeSession;
      if (!active || active.session_id !== sessionId || active.turn_count + 1 !== sequence)
        throw {
          code: 'invalid_request',
          message: 'The spoken question changed. Open Stuck again.',
        };
    };
    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    function result(kind: RescueKind): RescueResponse {
      if (kind === 'missing_word') return { kind, candidates: ['cache', 'buffer', 'memory'] };
      if (kind === 'simpler') return { kind, suggestion: 'It keeps my ideas in one place.' };
      return { kind, suggestion: 'For example, it helps me remember small tasks.' };
    }
    function requestValue(value: unknown): RescueRequest {
      if (typeof value !== 'object' || value === null) throw new Error('Missing rescue request');
      const kind: unknown = Reflect.get(value, 'kind');
      const question: unknown = Reflect.get(value, 'question');
      const partial_transcript: unknown = Reflect.get(value, 'partial_transcript');
      const description: unknown = Reflect.get(value, 'description');
      if (
        (kind !== 'next_step' && kind !== 'simpler' && kind !== 'missing_word') ||
        typeof question !== 'string' ||
        typeof partial_transcript !== 'string' ||
        typeof description !== 'string'
      )
        throw new Error('Invalid rescue request shape');
      return { kind, question, partial_transcript, description };
    }
    async function rescue(args: Record<string, unknown>) {
      current(args.session_id, args.sequence);
      const request = requestValue(args.request);
      edge.requests.push(request);
      const requestNumber = edge.requests.length;
      window.__ET_HARNESS__.calls.push({ command: 'rescue_answer', args });
      await original('record_answer_help_used', {
        sessionId: args.session_id,
        sequence: args.sequence,
      });
      const delayMs =
        requestNumber === 1 ? (seed.delayFirstMs ?? seed.delayMs ?? 0) : (seed.delayMs ?? 0);
      if (delayMs > 0) await delay(delayMs);
      const shouldFail =
        (seed.failFirst && requestNumber === 1) ||
        (seed.failKindOnce === request.kind && !failedKinds.has(request.kind));
      if (shouldFail) {
        failedKinds.add(request.kind);
        throw {
          code: 'unavailable',
          message: 'Rescue help could not respond. Keep speaking and retry Stuck.',
        };
      }
      edge.completed += 1;
      return result(request.kind);
    }
    window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === 'transcribe_rescue') {
        edge.snapshots += 1;
        return seed.noSpeech ? '' : 'I use a notebook because it helps';
      }
      if (command === 'rescue_answer') return rescue(args);
      if (command === 'transcribe_audio') {
        edge.finalTranscriptions += 1;
        return {
          text: 'I use a notebook because it helps me plan.',
          language: 'en',
          duration_ms: 2000,
        };
      }
      return original(command, args);
    };
  }, options);
}
