import { Effect } from 'effect';
import { ApiUsageService } from '../services/api-usage-service';
import { runtime } from './runtime';

export const apiUsageAtom = runtime.atom(
  Effect.gen(function* () {
    const service = yield* ApiUsageService;
    return yield* service.snapshot;
  }),
);
