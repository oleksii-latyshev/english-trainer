export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeName = 'light' | 'dark';

export type Appearance = { theme: ThemePreference };

export const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export const DEFAULT_APPEARANCE: Appearance = { theme: 'system' };
