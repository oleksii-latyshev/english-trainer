import type { EvaLook } from '../../palette';
import { evaLookCssVars } from '../eva-look-css';

export function applyEvaLook(look: EvaLook): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(evaLookCssVars(look))) {
    root.style.setProperty(name, value);
  }
  root.dataset.evaMotion = look.motion;
}
