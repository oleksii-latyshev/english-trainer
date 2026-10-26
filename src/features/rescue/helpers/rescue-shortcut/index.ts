import type { KeyTarget } from '@/shared/helpers/key-target';

export type RescuePress = {
  readonly key: string;
  readonly isComposing: boolean;
  readonly isRepeat: boolean;
  readonly hasModifier: boolean;
  readonly target: KeyTarget;
};

export function isRescueShortcut(press: RescuePress): boolean {
  return (
    !press.isComposing &&
    !press.isRepeat &&
    !press.hasModifier &&
    press.target === 'other' &&
    press.key.toLowerCase() === 's'
  );
}
