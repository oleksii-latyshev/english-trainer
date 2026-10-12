import { Effect } from 'effect';

export function bytesOf(blob: Blob): Effect.Effect<Uint8Array> {
  return Effect.promise(() => blob.arrayBuffer()).pipe(
    Effect.map((buffer) => new Uint8Array(buffer)),
  );
}
