import { createLocalPreference, isRecord } from '@/lib/localPreference';
import type { ThemePreference } from './applyTheme';

export const THEME_OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
] as const satisfies readonly { id: ThemePreference; label: string }[];

export const THEME_PREFERENCE_KEY = 'english_trainer_appearance';

export type AppearancePreference = { theme: ThemePreference };

export function parseAppearance(value: unknown): AppearancePreference {
  if (!isRecord(value)) return { theme: 'system' };
  const match = THEME_OPTIONS.find((option) => option.id === value.theme);
  return { theme: match ? match.id : 'system' };
}

export const appearancePreference = createLocalPreference<AppearancePreference>(
  THEME_PREFERENCE_KEY,
  parseAppearance,
);
