import { Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { GeminiKeyService } from '../services/gemini-key-service';
import type { GeminiKeyFailure } from '../types';
import { runtime } from './runtime';

const GEMINI_KEY = ['gemini-key'];

export const geminiKeyStatusAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* GeminiKeyService;
      return yield* service.status;
    }),
  )
  .pipe(Atom.runtime.withReactivity(GEMINI_KEY));

export const geminiKeyDraftAtom = Atom.make('');

const lastActionAtom = Atom.make<'save' | 'remove'>('save');

export const saveGeminiKeyAtom = runtime.fn(
  Effect.fn('saveGeminiKey')(function* (key: string, get: Atom.FnContext) {
    get.set(lastActionAtom, 'save');
    const service = yield* GeminiKeyService;
    yield* service.save(key);
    get.set(geminiKeyDraftAtom, '');
  }),
  { reactivityKeys: GEMINI_KEY },
);

export const removeGeminiKeyAtom = runtime.fn(
  Effect.fn('removeGeminiKey')(function* (_: undefined, get: Atom.FnContext) {
    get.set(lastActionAtom, 'remove');
    const service = yield* GeminiKeyService;
    yield* service.remove;
    get.set(geminiKeyDraftAtom, '');
  }),
  { reactivityKeys: GEMINI_KEY },
);

export const geminiKeyIsBusyAtom = Atom.make((get) => {
  const status = get(geminiKeyStatusAtom);
  const isRefreshing = AsyncResult.isWaiting(status) && !AsyncResult.isInitial(status);
  return (
    AsyncResult.isWaiting(get(saveGeminiKeyAtom)) ||
    AsyncResult.isWaiting(get(removeGeminiKeyAtom)) ||
    isRefreshing
  );
});

function settledFailure<A>(
  result: AsyncResult.AsyncResult<A, GeminiKeyFailure>,
): Option.Option<GeminiKeyFailure> {
  return AsyncResult.isWaiting(result) ? Option.none() : AsyncResult.error(result);
}

export const geminiKeyFailureAtom = Atom.make((get) => {
  const lastAction =
    get(lastActionAtom) === 'save' ? get(saveGeminiKeyAtom) : get(removeGeminiKeyAtom);
  return Option.orElse(settledFailure(lastAction), () => settledFailure(get(geminiKeyStatusAtom)));
});
