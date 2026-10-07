import { type EvaLook, evaLookCssVars, evaLookPreference } from '@/lib/evaLook';

function applyEvaLook(look: EvaLook): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(evaLookCssVars(look))) {
    root.style.setProperty(name, value);
  }
  // evaMoods.css switches animations off by this attribute, so the choice reaches every Eva.
  root.dataset.evaMotion = look.motion;
}

/** Applies the saved look to the whole document now and on every change. Returns an unsubscribe. */
export function startEvaLook(): () => void {
  const apply = () => applyEvaLook(evaLookPreference.get());
  apply();
  return evaLookPreference.subscribe(apply);
}
