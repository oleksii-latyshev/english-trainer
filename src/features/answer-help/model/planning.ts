import { Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { setPlanning } from '@/core/practice-turn';
import { remainingPlanningSeconds } from '../helpers/planning-timer';
import type { PlanningSeconds, PlanningTimer } from '../types';
import {
  helpKeyAtom,
  helpLevelAtom,
  isRecordingAtom,
  planningTimerAtom,
  remainingSecondsAtom,
} from './atoms';
import { runtime } from './runtime';

type Registry = AtomRegistry.AtomRegistry;

const TICK = '250 millis';

export function startPlanning(registry: Registry, seconds: PlanningSeconds) {
  if (registry.get(helpLevelAtom) !== 'frame' || registry.get(isRecordingAtom)) return;
  registry.set(planningTimerAtom, { durationSeconds: seconds, startedAt: Date.now() });
  registry.set(remainingSecondsAtom, seconds);
  setPlanning(registry, true);
}

export function cancelPlanning(registry: Registry) {
  if (registry.get(planningTimerAtom) === null) return;
  registry.set(planningTimerAtom, null);
  registry.set(remainingSecondsAtom, 0);
  setPlanning(registry, false);
}

function remainingNow(timer: PlanningTimer) {
  return remainingPlanningSeconds(timer.startedAt, Date.now(), timer.durationSeconds);
}

export const planningTickAtom = runtime.atom((get) => {
  const timer = get(planningTimerAtom);
  if (timer === null) return Effect.void;
  const { registry } = get;
  return Effect.gen(function* () {
    let remaining = remainingNow(timer);
    registry.set(remainingSecondsAtom, remaining);
    while (remaining > 0) {
      yield* Effect.sleep(TICK);
      remaining = remainingNow(timer);
      registry.set(remainingSecondsAtom, remaining);
    }
    cancelPlanning(registry);
  });
});

export const planningGuardAtom = Atom.family((isDisabled: boolean) =>
  Atom.make((get) => {
    get(helpKeyAtom);
    const isOpen = get(helpLevelAtom) === 'frame';
    if (isDisabled || !isOpen || get(isRecordingAtom)) cancelPlanning(get.registry);
  }),
);
