import { useAtomValue } from '@effect/atom-react';
import { useLayoutEffect } from 'react';
import { applyEvaLook } from '../../helpers/apply-eva-look';
import { evaLookAtom } from '../../model/atoms';

export function EvaLookApplier() {
  const look = useAtomValue(evaLookAtom);
  useLayoutEffect(() => applyEvaLook(look), [look]);
  return null;
}
