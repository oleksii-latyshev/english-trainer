import { Effect } from 'effect';
import { SpeakingActivityService } from '../services/speaking-activity-service';
import { runtime } from './runtime';

export const speakingActivityAtom = runtime.atom(
  Effect.gen(function* () {
    const service = yield* SpeakingActivityService;
    return yield* service.activity;
  }),
);
