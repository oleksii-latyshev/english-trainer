import { openUrl } from '@tauri-apps/plugin-opener';
import { Context, Data, Effect, Layer } from 'effect';
import { isTauriRuntime } from '@/core/ipc';

export class ExternalLinkError extends Data.TaggedError('ExternalLinkError')<{
  readonly url: string;
  readonly cause: unknown;
}> {}

type ExternalLinkServiceShape = {
  readonly open: (url: string) => Effect.Effect<void, ExternalLinkError>;
};

function openInBrowserTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
  return Promise.resolve();
}

export class ExternalLinkService extends Context.Service<
  ExternalLinkService,
  ExternalLinkServiceShape
>()('core/external-link/ExternalLinkService') {
  static readonly layer = Layer.succeed(ExternalLinkService, {
    open: (url) =>
      Effect.tryPromise({
        try: () => (isTauriRuntime() ? openUrl(url) : openInBrowserTab(url)),
        catch: (cause) => new ExternalLinkError({ url, cause }),
      }),
  });
}
