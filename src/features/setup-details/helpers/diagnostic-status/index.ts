import type { ComponentStatus } from '@/core/ipc';

const STATUS_LABELS: Record<ComponentStatus, string> = {
  available: 'Found',
  missing: 'Missing',
  unreadable: 'Cannot read',
};

export const PATH_NOT_FOUND = 'Path not found';
export const SETUP_UNREADABLE =
  'Setup details could not be read. Check the app installation and try again.';

export function statusLabel(status: ComponentStatus): string {
  return STATUS_LABELS[status];
}

export function pathLabel(path: string | null): string {
  return path ?? PATH_NOT_FOUND;
}
