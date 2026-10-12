import { useAtomValue } from '@effect/atom-react';
import { useLayoutEffect } from 'react';
import { applyTheme } from '../../helpers/apply-theme';
import { appearanceAtom } from '../../model/atoms';

export function ThemeApplier() {
  const { theme } = useAtomValue(appearanceAtom);
  useLayoutEffect(() => applyTheme(theme), [theme]);
  return null;
}
