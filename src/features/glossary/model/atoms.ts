import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { addTerm, removeTerm } from '../helpers/glossary';
import { GlossaryService } from '../services/glossary-service';
import { runtime } from './runtime';

const GLOSSARY = ['glossary'];

export const glossaryAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* GlossaryService;
      return yield* service.get;
    }),
  )
  .pipe(Atom.runtime.withReactivity(GLOSSARY));

export const glossaryDraftAtom = Atom.make('');

export const addGlossaryTermAtom = runtime.fn(
  Effect.fn('addGlossaryTerm')(function* (term: string, get: Atom.FnContext) {
    const service = yield* GlossaryService;
    const current = yield* service.get;
    const saved = yield* service.save(addTerm(current, term));
    get.set(glossaryDraftAtom, '');
    return saved;
  }),
  { reactivityKeys: GLOSSARY },
);

export const removeGlossaryTermAtom = runtime.fn(
  Effect.fn('removeGlossaryTerm')(function* (term: string) {
    const service = yield* GlossaryService;
    const current = yield* service.get;
    return yield* service.save(removeTerm(current, term));
  }),
  { reactivityKeys: GLOSSARY },
);
