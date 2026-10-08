import { invoke, isTauri } from '@tauri-apps/api/core';
import { createLocalPreference, isRecord } from './localPreference';

/** Mirrors `DockIcon` in Rust `dock_icon.rs`. */
export type DockIconId = 'dark' | 'light';

export const DOCK_ICONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const satisfies readonly { value: DockIconId; label: string }[];

export type DockIconPreference = { icon: DockIconId };

export const DOCK_ICON_KEY = 'english_trainer_dock_icon';

export function parseDockIcon(value: unknown): DockIconPreference {
  if (!isRecord(value)) return { icon: 'dark' };
  return { icon: value.icon === 'light' ? 'light' : 'dark' };
}

export const dockIconPreference = createLocalPreference<DockIconPreference>(
  DOCK_ICON_KEY,
  parseDockIcon,
);

async function applyDockIcon(icon: DockIconId): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke<void>('set_dock_icon', { icon });
  } catch (cause) {
    console.warn('Could not change the Dock icon.', cause);
  }
}

/**
 * Applies the saved Dock icon at launch and again whenever it changes. The preference is a UI
 * choice kept with Eva's look; the Dock tile only exists while the app runs, so it is re-applied
 * on every start.
 */
export function startDockIcon(): void {
  void applyDockIcon(dockIconPreference.get().icon);
  dockIconPreference.subscribe(() => void applyDockIcon(dockIconPreference.get().icon));
}
