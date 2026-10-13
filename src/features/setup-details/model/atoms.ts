import { Effect } from 'effect';
import { SetupDiagnosticsService } from '../services/setup-diagnostics-service';
import { runtime } from './runtime';

export const setupDiagnosticsAtom = runtime.atom(
  Effect.gen(function* () {
    const diagnostics = yield* SetupDiagnosticsService;
    return yield* diagnostics.read;
  }),
);
