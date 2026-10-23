import { listen } from '@tauri-apps/api/event';
import { Context, Effect, Layer, Option, Queue, Schema, Stream } from 'effect';

export type IpcEventsShape = {
  readonly listen: <A>(event: string, schema: Schema.Decoder<A>) => Stream.Stream<A>;
};

export class IpcEvents extends Context.Service<IpcEvents, IpcEventsShape>()('core/ipc/IpcEvents') {
  static readonly layer = Layer.succeed(IpcEvents, {
    listen: <A>(event: string, schema: Schema.Decoder<A>) => {
      const decode = Schema.decodeUnknownOption(schema);
      return Stream.callback<A>((queue) =>
        Effect.acquireRelease(
          Effect.promise(() =>
            listen<unknown>(event, (message) => {
              const decoded = decode(message.payload);
              if (Option.isSome(decoded)) Queue.offerUnsafe(queue, decoded.value);
            }),
          ),
          (unlisten) => Effect.sync(unlisten),
        ),
      );
    },
  });
}
