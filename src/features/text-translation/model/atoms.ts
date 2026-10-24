import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { TextExplanation, TextTranslation, TranslationRequest } from '@/core/ipc';
import { TextTranslationService } from '../services/text-translation-service';
import type { Explanation, Lookup, TextSelection } from '../types';
import { runtime } from './runtime';

export type LookupInput =
  | { readonly stage: 'translation'; readonly request: TranslationRequest }
  | { readonly stage: 'explanation' };

export const selectionAtom = Atom.make<TextSelection | undefined>(undefined).pipe(Atom.keepAlive);
export const panelOpenAtom = Atom.make(false).pipe(Atom.keepAlive);
export const draftAtom = Atom.make('').pipe(Atom.keepAlive);
export const draftContextAtom = Atom.make<TranslationRequest | undefined>(undefined).pipe(
  Atom.keepAlive,
);
export const lookupAtom = Atom.make<Lookup>({ tag: 'idle' }).pipe(Atom.keepAlive);

function translated(
  request: TranslationRequest,
  translation: TextTranslation,
  explanation: Explanation,
): Lookup {
  return { tag: 'translated', request, translation, explanation };
}

function explanationStage(
  get: Atom.FnContext,
  service: TextTranslationService['Service'],
  request: TranslationRequest,
  translation: TextTranslation,
) {
  return Effect.gen(function* () {
    get.set(lookupAtom, translated(request, translation, { tag: 'pending' }));
    yield* service.explain(request).pipe(
      Effect.matchEffect({
        onSuccess: (explained: TextExplanation) =>
          Effect.sync(() =>
            get.set(
              lookupAtom,
              translated(request, translation, {
                tag: 'ready',
                text: explained.english_explanation,
              }),
            ),
          ),
        onFailure: (failure) =>
          Effect.sync(() =>
            get.set(lookupAtom, translated(request, translation, { tag: 'failed', failure })),
          ),
      }),
    );
  });
}

export const lookupCommandAtom = runtime.fn(
  Effect.fn('lookupText')(function* (input: LookupInput, get: Atom.FnContext) {
    const service = yield* TextTranslationService;
    if (input.stage === 'explanation') {
      const current = get(lookupAtom);
      if (current.tag !== 'translated') return;
      yield* explanationStage(get, service, current.request, current.translation);
      return;
    }
    const { request } = input;
    get.set(lookupAtom, { tag: 'translating', text: request.text });
    const translation = yield* service.translate(request).pipe(
      Effect.matchEffect({
        onSuccess: (value) => Effect.succeed(value),
        onFailure: (failure) =>
          Effect.sync(() => {
            get.set(lookupAtom, { tag: 'failed', failure });
            return undefined;
          }),
      }),
    );
    if (translation === undefined) return;
    yield* explanationStage(get, service, request, translation);
  }),
);
