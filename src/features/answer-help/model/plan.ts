import { Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { isTauriRuntime } from '@/core/ipc';
import { sessionDetailsAtom } from '@/core/practice-session';
import { helpTargetOf } from '../helpers/help-key';
import { AnswerHelpService } from '../services/answer-help-service';
import type { PlanRequest, PlanState } from '../types';
import { helpKeyAtom, planRequestAtom, planStoreAtom } from './atoms';
import { runtime } from './runtime';

export const loadPlanAtom = runtime.fn(
  Effect.fn('loadAnswerPlan')(function* (input: PlanRequest, get: Atom.FnContext) {
    const service = yield* AnswerHelpService;
    const { registry } = get;
    const { target } = input;
    const request = registry.get(planRequestAtom) + 1;
    registry.set(planRequestAtom, request);
    registry.set(planStoreAtom, { tag: 'loading', key: target.key });
    function settle(state: PlanState) {
      return Effect.sync(() => {
        if (registry.get(planRequestAtom) === request) registry.set(planStoreAtom, state);
      });
    }
    yield* service.plan(target, input.retry).pipe(
      Effect.matchEffect({
        onSuccess: (plan) => settle({ tag: 'ready', key: target.key, plan }),
        onFailure: (failure) => settle({ tag: 'failed', key: target.key, failure }),
      }),
    );
  }),
);

export const planPrefetchAtom = Atom.make((get) => {
  const key = get(helpKeyAtom);
  const target = helpTargetOf(get.registry.get(sessionDetailsAtom));
  if (target === null || target.key !== key || !isTauriRuntime()) return;
  get.registry.set(loadPlanAtom, { target, retry: false });
});

export function retryPlan(registry: AtomRegistry.AtomRegistry) {
  const target = helpTargetOf(registry.get(sessionDetailsAtom));
  if (target === null || !isTauriRuntime()) return;
  registry.set(loadPlanAtom, { target, retry: true });
}
