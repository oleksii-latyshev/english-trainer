export type DockIcon = 'eva' | 'dark' | 'light';

export type DockIconPreference = { icon: DockIcon };

export const DOCK_ICONS = [
  { value: 'eva', label: 'Eva' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const satisfies readonly { value: DockIcon; label: string }[];

export const DEFAULT_DOCK_ICON: DockIconPreference = { icon: 'eva' };
