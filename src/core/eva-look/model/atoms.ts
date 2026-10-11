import { Atom } from 'effect/reactivity';
import { applyEvaLook } from '../helpers/apply-eva-look';
import { readStoredEvaLook, storeEvaLook } from '../helpers/eva-look-storage';

export const evaLookAtom = Atom.make(readStoredEvaLook()).pipe(Atom.keepAlive);

export const evaLookAppliedAtom = Atom.make((get) => {
  const look = get(evaLookAtom);
  applyEvaLook(look);
  storeEvaLook(look);
}).pipe(Atom.keepAlive);
