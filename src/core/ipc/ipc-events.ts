import { listen } from '@tauri-apps/api/event';
import { Context, Effect, Layer, Option, Queue, Schema, Stream } from 'effect';

export type IpcSubscription<A> = {
  readonly event: string;
  readonly schema: Schema.Decoder<A>;
};

export type IpcEventsShape = {
  readonly listen: <A>(event: string, schema: Schema.Decoder<A>) => Stream.Stream<A>;
  readonly listenAll: <A>(
    subscriptions: ReadonlyArray<IpcSubscription<A>>,
  ) => Stream.Stream<Option.Option<A>>;
};

function subscribe<A>(
  subscription: IpcSubscription<A>,
  onEvent: (value: A) => void,
): Promise<() => void> {
  const decode = Schema.decodeUnknownOption(subscription.schema);
  return listen<unknown>(subscription.event, (message) => {
    const decoded = decode(message.payload);
    if (Option.isSome(decoded)) onEvent(decoded.value);
  });
}

export class IpcEvents extends Context.Service<IpcEvents, IpcEventsShape>()('core/ipc/IpcEvents') {
  static readonly layer = Layer.succeed(IpcEvents, {
    listen: <A>(event: string, schema: Schema.Decoder<A>) =>
      Stream.callback<A>((queue) =>
        Effect.acquireRelease(
          Effect.promise(() =>
            subscribe({ event, schema }, (value) => Queue.offerUnsafe(queue, value)),
          ),
          (unlisten) => Effect.sync(unlisten),
        ),
      ),
    listenAll: <A>(subscriptions: ReadonlyArray<IpcSubscription<A>>) =>
      Stream.callback<Option.Option<A>>((queue) =>
        Effect.acquireRelease(
          Effect.promise(() =>
            Promise.all(
              subscriptions.map((subscription) =>
                subscribe(subscription, (value) => Queue.offerUnsafe(queue, Option.some(value))),
              ),
            ),
          ).pipe(Effect.tap(() => Effect.sync(() => Queue.offerUnsafe(queue, Option.none())))),
          (unlistens) =>
            Effect.sync(() => {
              for (const unlisten of unlistens) unlisten();
            }),
        ),
      ),
  });
}
