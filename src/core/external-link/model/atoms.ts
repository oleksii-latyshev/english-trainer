import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { ExternalLinkService } from '../services/external-link-service';

const runtime = Atom.runtime(ExternalLinkService.layer);

export const openExternalLinkAtom = runtime.fn(
  Effect.fn('openExternalLink')(function* (url: string) {
    const service = yield* ExternalLinkService;
    yield* service.open(url);
  }),
);
