import type { ThemeName, ThemePreference } from '../../theme';

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

export function applyTheme(preference: ThemePreference): () => void {
  const query = window.matchMedia(DARK_QUERY);
  function apply() {
    setRootTheme(resolveTheme(preference, query.matches));
  }
  apply();
  query.addEventListener('change', apply);
  return () => query.removeEventListener('change', apply);
}
