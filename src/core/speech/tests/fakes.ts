import { Clock, Effect, Layer, Stream } from 'effect';
import { type DiagnosticEvent, Diagnostics } from '@/core/diagnostics';
import { IpcError } from '@/core/ipc';
import { CLOCK_POLL_MS } from '../helpers/speech-timing';
import { AudioOutput, AudioOutputError, type AudioSession } from '../services/audio-output-service';
import { NaturalVoice } from '../services/natural-voice-service';
import { SystemVoice } from '../services/system-voice-service';
import type { SpeechCallbacks, SpeechState } from '../types';

const SYNTHESIS_FIXED_MS = 250;
const SYNTHESIS_PER_CHAR_MS = 11;
const AUDIO_PER_CHAR_MS = 55;
const SCHEDULE_LEAD_IN_MS = 30;

type RecordedClip = {
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly pauseBeforeMs: number;
};

type RecordedRequest = {
  readonly text: string;
  readonly atMs: number;
};

export type NaturalBehaviour = {
  readonly latencyMs?: (text: string, index: number) => number;
  readonly failure?: (index: number) => 'busy' | 'unavailable' | undefined;
  readonly decodeFails?: boolean;
  readonly openFails?: boolean;
  readonly isReady?: boolean;
  readonly neverStarts?: boolean;
};

export function audioMsOf(text: string): number {
  return text.length * AUDIO_PER_CHAR_MS;
}

function sleepUntil(targetMs: number): Effect.Effect<void> {
  return Effect.suspend(() =>
    Clock.currentTimeMillis.pipe(
      Effect.flatMap((now) =>
        now >= targetMs
          ? Effect.void
          : Effect.sleep(CLOCK_POLL_MS).pipe(Effect.flatMap(() => sleepUntil(targetMs))),
      ),
    ),
  );
}

function fakeAudioOutput(behaviour: NaturalBehaviour) {
  const clips: RecordedClip[] = [];
  const closedSessions: number[] = [];
  const queue = { endsAtMs: 0 };

  const session: AudioSession = {
    enqueue: (wave, pauseBeforeMs) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) => {
          if (behaviour.decodeFails) return Effect.fail(new AudioOutputError({ stage: 'decode' }));
          const startsAtMs = Math.max(now + SCHEDULE_LEAD_IN_MS, queue.endsAtMs + pauseBeforeMs);
          const endsAtMs = startsAtMs + wave.byteLength;
          queue.endsAtMs = endsAtMs;
          clips.push({ startsAtMs, endsAtMs, pauseBeforeMs });
          return Effect.succeed({ startsAtMs, endsAtMs });
        }),
      ),
    leadMs: Clock.currentTimeMillis.pipe(Effect.map((now) => Math.max(0, queue.endsAtMs - now))),
    untilStarted: (handle) =>
      behaviour.neverStarts ? Effect.never : sleepUntil(handle.startsAtMs),
    untilIdle: Effect.suspend(() => sleepUntil(queue.endsAtMs)),
  };

  const layer = Layer.succeed(AudioOutput, {
    open: behaviour.openFails
      ? Effect.fail(new AudioOutputError({ stage: 'open' }))
      : Effect.acquireRelease(Effect.succeed(session), () =>
          Effect.sync(() => closedSessions.push(closedSessions.length)),
        ),
    pause: Effect.void,
    resume: Effect.void,
  });
  return { layer, clips, closedSessions };
}

function fakeNaturalVoice(behaviour: NaturalBehaviour) {
  const requests: RecordedRequest[] = [];
  const engine = { prewarms: 0 };
  const layer = Layer.succeed(NaturalVoice, {
    prewarm: Effect.sync(() => {
      engine.prewarms += 1;
      return behaviour.isReady ?? true;
    }),
    synthesize: (text) =>
      Effect.gen(function* () {
        const index = requests.length;
        requests.push({ text, atMs: yield* Clock.currentTimeMillis });
        yield* Effect.sleep(
          behaviour.latencyMs?.(text, index) ??
            SYNTHESIS_FIXED_MS + SYNTHESIS_PER_CHAR_MS * text.length,
        );
        const failure = behaviour.failure?.(index);
        if (failure) {
          return yield* new IpcError({ code: failure, message: 'Fixture failure' });
        }
        return new ArrayBuffer(audioMsOf(text));
      }),
  });
  return { layer, requests, engine };
}

function fakeDiagnostics() {
  const events: DiagnosticEvent[] = [];
  const layer = Layer.succeed(Diagnostics, {
    record: (event) => Effect.sync(() => void events.push(event)),
  });
  return { layer, events };
}

function fakeSystemVoice() {
  const spoken: RecordedRequest[] = [];
  const layer = Layer.succeed(SystemVoice, {
    isSupported: Effect.succeed(true),
    voices: Stream.empty,
    speak: (utterance) =>
      Stream.make(undefined).pipe(
        Stream.tap(() =>
          Clock.currentTimeMillis.pipe(
            Effect.map((atMs) => spoken.push({ text: utterance.text, atMs })),
          ),
        ),
        Stream.concat(
          Stream.fromEffect(Effect.sleep(audioMsOf(utterance.text))).pipe(Stream.drain),
        ),
      ),
    pause: Effect.void,
    resume: Effect.void,
    cancel: Effect.void,
  });
  return { layer, spoken };
}

export function fakeSpeechEdges(behaviour: NaturalBehaviour = {}) {
  const audio = fakeAudioOutput(behaviour);
  const natural = fakeNaturalVoice(behaviour);
  const system = fakeSystemVoice();
  const diagnostics = fakeDiagnostics();
  return {
    layer: Layer.mergeAll(audio.layer, natural.layer, system.layer, diagnostics.layer),
    diagnosticEvents: diagnostics.events,
    clips: audio.clips,
    closedSessions: audio.closedSessions,
    requests: natural.requests,
    engine: natural.engine,
    spoken: system.spoken,
  };
}

export function recordingCallbacks() {
  const states: SpeechState[] = [];
  const events: string[] = [];
  const firstAudioLatencies: number[] = [];
  const callbacks: SpeechCallbacks = {
    onState: (state) => states.push(state),
    onFirstAudio: (latencyMs) => {
      firstAudioLatencies.push(latencyMs);
      events.push('first-audio');
    },
    onEnd: () => events.push('end'),
    onError: () => events.push('error'),
    onNaturalFailure: () => events.push('natural-failure'),
  };
  return { callbacks, states, events, firstAudioLatencies };
}
