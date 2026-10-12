import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { SAMPLE_SENTENCE } from '../helpers/response-test-copy';
import { ResponseTestService } from '../services/response-test-service';
import { runtime } from './runtime';

export const responseTestStreamAtom = Atom.make('');

export const runResponseTestAtom = runtime.fn(
  Effect.fn('runResponseTest')(function* (_: undefined, get: Atom.FnContext) {
    get.set(responseTestStreamAtom, '');
    const service = yield* ResponseTestService;
    return yield* service.run(SAMPLE_SENTENCE, (text) =>
      get.set(responseTestStreamAtom, get(responseTestStreamAtom) + text),
    );
  }),
);
