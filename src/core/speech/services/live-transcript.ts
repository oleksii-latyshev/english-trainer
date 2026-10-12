import { Duration, Effect, Option, Semaphore, Stream } from 'effect';
import { SpeechRecognition } from './speech-recognition-service';

export const LIVE_INTERVAL = Duration.millis(1500);

export type LiveTranscriptSource = {
  readonly snapshot: Effect.Effect<Blob | null, unknown>;
  readonly hasHeardSpeech: Effect.Effect<boolean>;
};

function liveUpdate(
  recognition: SpeechRecognition['Service'],
  source: LiveTranscriptSource,
): Effect.Effect<Option.Option<string>> {
  return Effect.gen(function* () {
    if (!(yield* source.hasHeardSpeech)) return Option.none<string>();
    const wav = yield* source.snapshot;
    if (!wav) return Option.none<string>();
    const text = yield* recognition.transcribePartial(wav);
    return Option.fromNullishOr(text).pipe(Option.filter((value) => value.length > 0));
  }).pipe(Effect.catch(() => Effect.succeed(Option.none<string>())));
}

export function liveTranscript(
  source: LiveTranscriptSource,
): Stream.Stream<string, never, SpeechRecognition> {
  return Stream.unwrap(
    Effect.gen(function* () {
      const recognition = yield* SpeechRecognition;
      const status = yield* recognition.engineStatus.pipe(Effect.option);
      const isAvailable = Option.exists(
        status,
        (value) => value.server === 'ready' && value.is_live_transcript_available,
      );
      if (!isAvailable) return Stream.empty;
      const oneAtATime = yield* Semaphore.make(1);
      return Stream.tick(LIVE_INTERVAL).pipe(
        Stream.drop(1),
        Stream.mapEffect(
          () => oneAtATime.withPermitsIfAvailable(1)(liveUpdate(recognition, source)),
          {
            concurrency: 'unbounded',
          },
        ),
        Stream.map((update) => Option.flatten(update)),
        Stream.filter(Option.isSome),
        Stream.map((update) => update.value),
      );
    }),
  );
}
