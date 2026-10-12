import { Effect, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { NaturalVoiceId } from '@/core/voice-preference';
import {
  EMPTY_REPLY_LOG,
  type ReplyLog,
  START_OF_REPLY,
  undeliveredEvents,
} from '../helpers/reply-log';
import { Speech } from '../services/speech-service';
import type { SpeechEngineChoice, SpeechState, StreamOptions } from '../types';
import { runtime } from './runtime';

export const speechStateAtom = Atom.make<SpeechState>({ tag: 'idle' }).pipe(Atom.keepAlive);

export const replyLogAtom = Atom.make<ReplyLog>(EMPTY_REPLY_LOG).pipe(Atom.keepAlive);

export const naturalAvailabilityAtom = runtime
  .atom(
    Effect.gen(function* () {
      const speech = yield* Speech;
      return yield* speech.prewarm;
    }),
  )
  .pipe(Atom.keepAlive);

export const systemVoicesAtom = runtime
  .atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const speech = yield* Speech;
        return speech.systemVoices;
      }),
    ),
  )
  .pipe(Atom.keepAlive);

export type SpeakInput = {
  readonly streamId: number;
  readonly engine: SpeechEngineChoice;
  readonly rate: number;
  readonly options: StreamOptions;
};

export const speakAtom = runtime
  .fn(
    Effect.fn('speak')(function* (input: SpeakInput, get: Atom.FnContext) {
      const speech = yield* Speech;
      const replies = get.stream(replyLogAtom).pipe(
        Stream.filter((log) => log.streamId === input.streamId),
        Stream.mapAccum(
          () => START_OF_REPLY,
          (cursor, log) => undeliveredEvents(cursor, log),
        ),
        Stream.takeUntil((event) => event._tag === 'Final'),
      );
      yield* speech.speak({
        engine: input.engine,
        rate: input.rate,
        replies,
        callbacks: {
          onState: (state) => get.set(speechStateAtom, state),
          onFirstAudio: (latencyMs) => input.options.onStart?.(latencyMs),
          onEnd: () => input.options.onEnd?.(),
          onError: () => input.options.onError?.(),
          onNaturalFailure: () => get.refresh(naturalAvailabilityAtom),
        },
      });
    }),
  )
  .pipe(Atom.keepAlive);

export const pauseSpeechAtom = runtime.fn(
  Effect.fn('pauseSpeech')(function* (_: undefined, get: Atom.FnContext) {
    const speech = yield* Speech;
    yield* speech.pause;
    get.set(speechStateAtom, { tag: 'paused' });
  }),
);

export const resumeSpeechAtom = runtime.fn(
  Effect.fn('resumeSpeech')(function* (_: undefined, get: Atom.FnContext) {
    const speech = yield* Speech;
    yield* speech.resume;
    get.set(speechStateAtom, { tag: 'speaking' });
  }),
);

const requestedPreviewAtom = Atom.make<NaturalVoiceId | null>(null);

export const previewNaturalVoiceAtom = runtime.fn(
  Effect.fn('previewNaturalVoice')(function* (
    input: { readonly text: string; readonly voiceId: NaturalVoiceId; readonly rate: number },
    get: Atom.FnContext,
  ) {
    const speech = yield* Speech;
    get.set(requestedPreviewAtom, input.voiceId);
    yield* speech
      .preview(input.text, input.voiceId, input.rate)
      .pipe(Effect.tapError(() => Effect.sync(() => get.refresh(naturalAvailabilityAtom))));
  }),
);

export const previewingNaturalVoiceAtom = Atom.make((get) =>
  AsyncResult.isWaiting(get(previewNaturalVoiceAtom)) ? get(requestedPreviewAtom) : null,
);
