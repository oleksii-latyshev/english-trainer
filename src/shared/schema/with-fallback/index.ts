import { Effect, Schema } from 'effect';

export function withFallback<A, S extends Schema.Codec<A, A>>(schema: S, fallback: A) {
  return schema.pipe(
    Schema.catchDecoding(() => Effect.succeedSome(fallback)),
    Schema.withDecodingDefault(Effect.succeed(fallback)),
  );
}
