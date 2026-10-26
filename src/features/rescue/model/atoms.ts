import { Atom } from 'effect/reactivity';
import { captureRequestIdAtom, captureStateAtom } from '@/core/answer-capture';
import { sessionDetailsAtom } from '@/core/practice-session';
import { rescueTargetOf } from '../helpers/rescue-target';
import type { RescueEntry, RescueState } from '../types';

const CLOSED: RescueState = { tag: 'closed' };

export const rescueTargetAtom = Atom.make((get) => {
  if (get(captureStateAtom).tag !== 'recording') return null;
  return rescueTargetOf(get(sessionDetailsAtom), get(captureRequestIdAtom));
});

export const rescueEntryAtom = Atom.keepAlive(Atom.make<RescueEntry | null>(null));

export const rescueStateAtom = Atom.make((get): RescueState => {
  const entry = get(rescueEntryAtom);
  const target = get(rescueTargetAtom);
  return entry !== null && target !== null && entry.key === target.key ? entry.state : CLOSED;
});

export const rescueGenerationAtom = Atom.keepAlive(Atom.make(0));

export const heldRecordingAtom = Atom.keepAlive(Atom.make<number | null>(null));
