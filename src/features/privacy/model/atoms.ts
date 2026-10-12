import { Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { PrivacyService } from '../services/privacy-service';
import type { PrivacyAction, PrivacyFailure } from '../types';
import { runtime } from './runtime';

const PRIVACY = ['privacy'];

export const retentionAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* PrivacyService;
      return yield* service.retention;
    }),
  )
  .pipe(Atom.runtime.withReactivity(PRIVACY));

const lastActionAtom = Atom.make<PrivacyAction>('save');

export const setKeepRawAudioAtom = runtime.fn(
  Effect.fn('setKeepRawAudio')(function* (keepsAudio: boolean, get: Atom.FnContext) {
    get.set(lastActionAtom, 'save');
    const service = yield* PrivacyService;
    yield* service.setKeepRawAudio(keepsAudio);
  }),
  { reactivityKeys: PRIVACY },
);

export const deleteKeptRecordingsAtom = runtime.fn(
  Effect.fn('deleteKeptRecordings')(function* (_: undefined, get: Atom.FnContext) {
    get.set(lastActionAtom, 'delete');
    const service = yield* PrivacyService;
    yield* service.deleteKeptRecordings;
  }),
  { reactivityKeys: PRIVACY },
);

function settledFailure<A>(
  result: AsyncResult.AsyncResult<A, PrivacyFailure>,
): Option.Option<PrivacyFailure> {
  return AsyncResult.isWaiting(result) ? Option.none() : AsyncResult.error(result);
}

export const privacyProblemAtom = Atom.make((get) => {
  const action = get(lastActionAtom);
  const result = action === 'save' ? get(setKeepRawAudioAtom) : get(deleteKeptRecordingsAtom);
  return Option.map(settledFailure(result), () => action);
});
