import type { AtomRegistry } from 'effect/reactivity';
import { holdForRescue } from '@/core/answer-capture';
import type { RescueTarget } from '../types';
import { heldRecordingAtom } from './atoms';

export function holdOpen(registry: AtomRegistry.AtomRegistry, target: RescueTarget) {
  holdForRescue(registry, target.recordingId, true);
  registry.set(heldRecordingAtom, target.recordingId);
}

export function releaseHold(registry: AtomRegistry.AtomRegistry) {
  const recordingId = registry.get(heldRecordingAtom);
  if (recordingId === null) return;
  registry.set(heldRecordingAtom, null);
  holdForRescue(registry, recordingId, false);
}
