export type ThemeName = 'dark' | 'light';

/** A stored user choice can later be passed in; today the macOS appearance decides. */
export type ThemePreference = ThemeName | 'system';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ThemeName {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return preference;
}

function setRootTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

/** Applies the theme now and keeps following the system appearance. Returns an unsubscribe. */
export function startTheme(preference: ThemePreference = 'system'): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const apply = () => setRootTheme(resolveTheme(preference, query.matches));
  apply();
  query.addEventListener('change', apply);
  return () => query.removeEventListener('change', apply);
}
