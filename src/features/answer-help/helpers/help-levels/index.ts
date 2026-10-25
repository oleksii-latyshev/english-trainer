import type { KeyTarget } from '@/shared/helpers/key-target';

export type HelpLevel = 'frame' | 'phrases' | 'example';

export const HELP_LEVELS: { id: HelpLevel; label: string; keyNumber: number }[] = [
  { id: 'frame', label: 'Frame', keyNumber: 1 },
  { id: 'phrases', label: 'Phrases', keyNumber: 2 },
  { id: 'example', label: 'Example', keyNumber: 3 },
];

export function helpLevelForKey(
  key: string,
  current: HelpLevel | null,
): { level: HelpLevel | null } | null {
  if (key.toLowerCase() === 'h') return { level: current === null ? HELP_LEVELS[0].id : null };
  const level = HELP_LEVELS.find((item) => String(item.keyNumber) === key);
  if (!level) return null;
  return { level: current === level.id ? null : level.id };
}

export type HelpKeyPress = {
  key: string;
  isRepeat: boolean;
  hasModifier: boolean;
  target: KeyTarget;
};

export function helpLevelForPress(
  press: HelpKeyPress,
  context: { helpLevel: HelpLevel | null; isHelpAvailable: boolean },
): { level: HelpLevel | null } | null {
  if (press.hasModifier || press.target === 'text') return null;
  if (press.isRepeat || !context.isHelpAvailable) return null;
  return helpLevelForKey(press.key, context.helpLevel);
}
