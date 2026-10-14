import { Effect, Exit } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import { ReviewRunService } from '@/core/learning-memory';
import { begin, fail, summarized } from '../helpers/review-session';
import { sessionAtom, summaryReachedAtom } from './session-atoms';

export function finishRun(registry: AtomRegistry.AtomRegistry) {
  return Effect.gen(function* () {
    const session = registry.get(sessionAtom);
    if (session === null || session.pending !== 'none') return;
    registry.set(sessionAtom, begin(session, 'finishing'));
    const service = yield* ReviewRunService;
    const exit = yield* Effect.exit(service.finish(session.run.run_id));
    const latest = registry.get(sessionAtom);
    if (latest === null) return;
    if (Exit.isFailure(exit)) {
      registry.set(sessionAtom, fail(latest, 'finish'));
      return;
    }
    registry.set(sessionAtom, summarized(latest));
    registry.set(summaryReachedAtom, true);
  });
}
