import { Atom } from 'effect/reactivity';
import { createPlayback } from '@/core/speech';
import {
  captureEpochAtom,
  helpKeyAtom,
  helpLevelAtom,
  isCaptureStartedAtom,
  requestedLevelAtom,
  wasCapturingAtom,
} from './atoms';
import { selectLevel, supersedePendingOpen } from './help-level';

export const exampleGuardAtom = Atom.make((get) => {
  const { registry } = get;
  if (!get(isCaptureStartedAtom)) {
    registry.set(wasCapturingAtom, false);
    return;
  }
  if (registry.get(wasCapturingAtom)) return;
  registry.set(wasCapturingAtom, true);
  registry.set(captureEpochAtom, registry.get(captureEpochAtom) + 1);
  const isExampleOpen = registry.get(helpLevelAtom) === 'example';
  if (!isExampleOpen && registry.get(requestedLevelAtom) !== 'example') return;
  supersedePendingOpen(registry);
  registry.set(requestedLevelAtom, null);
  if (!isExampleOpen) return;
  selectLevel(registry, registry.get(helpKeyAtom), null);
  createPlayback(registry).stop();
});
