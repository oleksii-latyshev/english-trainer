import { useAtomMount } from '@effect/atom-react';
import { evaLookAppliedAtom } from '../../model/atoms';

export function EvaLookApplier() {
  useAtomMount(evaLookAppliedAtom);
  return null;
}
