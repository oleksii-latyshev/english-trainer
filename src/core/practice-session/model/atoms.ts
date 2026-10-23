import { Atom } from 'effect/reactivity';
import { isTauriRuntime } from '@/core/ipc';
import { isSessionBusy, isSessionOpen, sessionDetails } from '../helpers/practice-state';
import type { PracticeState } from '../types';

function initialState(): PracticeState {
  return isTauriRuntime() ? { tag: 'loading' } : { tag: 'idle' };
}

export const practiceStateAtom = Atom.keepAlive(Atom.make<PracticeState>(initialState()));

export const practiceErrorAtom = Atom.keepAlive(Atom.make(''));

export const sessionDetailsAtom = Atom.make((get) => sessionDetails(get(practiceStateAtom)));

export const isSessionOpenAtom = Atom.make((get) => isSessionOpen(get(practiceStateAtom)));

export const isSessionBusyAtom = Atom.make((get) => isSessionBusy(get(practiceStateAtom)));

export const isRestoringAtom = Atom.make((get) => get(practiceStateAtom).tag === 'loading');
