import { Effect, Option, Stream } from 'effect';
import { AsyncResult, Atom, Reactivity } from 'effect/reactivity';
import { repeatedRules } from '../helpers/usual-rules';
import { MistakesService } from '../services/mistakes-service';
import type { MistakeGroup, RuleKey } from '../types';
import { runtime } from './runtime';

export const MISTAKES = ['mistakes'];

export const mistakeGroupsAtom = runtime
  .atom(Effect.flatMap(MistakesService, (service) => service.groups))
  .pipe(Atom.runtime.withReactivity(MISTAKES));

export const mistakeDetailAtom = Atom.family((id: number) =>
  runtime
    .atom(Effect.flatMap(MistakesService, (service) => service.detail(id)))
    .pipe(Atom.runtime.withReactivity(MISTAKES)),
);

export const ruleCardAtom = Atom.family((ruleKey: RuleKey) =>
  runtime.atom(Effect.flatMap(MistakesService, (service) => service.ruleCard(ruleKey))),
);

export const mistakesUpdatesAtom = runtime.atom(
  Effect.flatMap(MistakesService, (service) =>
    Stream.runForEach(service.updates, () => Reactivity.invalidate(MISTAKES)),
  ),
);

export const dueMistakeCountAtom = Atom.make((get): number =>
  Option.match(AsyncResult.value(get(mistakeGroupsAtom)), {
    onNone: () => 0,
    onSome: (groups) => groups.due_count,
  }),
);

export type UsualRules =
  | { readonly tag: 'loading' }
  | { readonly tag: 'unavailable' }
  | { readonly tag: 'ready'; readonly rules: readonly MistakeGroup[] };

export const usualRulesAtom = Atom.make((get): UsualRules => {
  const result = get(mistakeGroupsAtom);
  return Option.match(AsyncResult.value(result), {
    onSome: (groups) => ({ tag: 'ready', rules: repeatedRules(groups) }),
    onNone: () => (AsyncResult.isFailure(result) ? { tag: 'unavailable' } : { tag: 'loading' }),
  });
});
