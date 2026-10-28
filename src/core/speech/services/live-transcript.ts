import { Duration, Effect, Option, Ref, Semaphore, Stream } from 'effect';
import type { CaptureWindow } from '@/core/audio';
import { advanceLiveWindow, EMPTY_LIVE_WINDOW, type LiveWindow } from '../helpers/live-window';
import { SpeechRecognition } from './speech-recognition-service';

export const LIVE_INTERVAL = Duration.millis(1500);

export type LiveTranscriptSource = {
  readonly window: (fromMs: number) => Effect.Effect<CaptureWindow | null, unknown>;
  readonly hasHeardSpeech: Effect.Effect<boolean>;
};

type Availability = 'unknown' | 'ready' | 'unavailable';

function checkAvailability(recognition: SpeechRecognition['Service']) {
  return recognition.engineStatus.pipe(
    Effect.option,
    Effect.map((status): Availability => {
      if (Option.isNone(status) || status.value.server !== 'ready') return 'unknown';
      return status.value.is_live_transcript_available ? 'ready' : 'unavailable';
    }),
  );
}

function liveUpdate(
  recognition: SpeechRecognition['Service'],
  source: LiveTranscriptSource,
  state: Ref.Ref<LiveWindow>,
): Effect.Effect<Option.Option<string>> {
  return Effect.gen(function* () {
    if (!(yield* source.hasHeardSpeech)) return Option.none<string>();
    const current = yield* Ref.get(state);
    const captured = yield* source.window(current.offsetMs);
    if (!captured) return Option.none<string>();
    const text = yield* recognition.transcribePartial(captured.wav);
    if (text === null) return Option.none<string>();
    const step = advanceLiveWindow(current, text, captured.endMs);
    yield* Ref.set(state, step.window);
    return Option.some(step.text).pipe(Option.filter((value) => value.length > 0));
  }).pipe(Effect.catch(() => Effect.succeed(Option.none<string>())));
}

export function liveTranscript(
  source: LiveTranscriptSource,
): Stream.Stream<string, never, SpeechRecognition> {
  return Stream.unwrap(
    Effect.gen(function* () {
      const recognition = yield* SpeechRecognition;
      const oneAtATime = yield* Semaphore.make(1);
      const availability = yield* Ref.make<Availability>('unknown');
      const state = yield* Ref.make(EMPTY_LIVE_WINDOW);
      const tick = Effect.gen(function* () {
        if ((yield* Ref.get(availability)) === 'unknown') {
          yield* Ref.set(availability, yield* checkAvailability(recognition));
        }
        if ((yield* Ref.get(availability)) !== 'ready') return Option.none<string>();
        return yield* liveUpdate(recognition, source, state);
      });
      return Stream.tick(LIVE_INTERVAL).pipe(
        Stream.drop(1),
        Stream.mapEffect(() => oneAtATime.withPermitsIfAvailable(1)(tick), {
          concurrency: 'unbounded',
        }),
        Stream.map((update) => Option.flatten(update)),
        Stream.filter(Option.isSome),
        Stream.map((update) => update.value),
      );
    }),
  );
}
