import type { RunView } from '@/core/mistakes';

export function firstOpenPosition(run: RunView): number {
  const open = run.items.findIndex((item) => item.result === null);
  return open === -1 ? run.items.length : open;
}

export function positionOf(run: RunView, cursor: number | null): number {
  return Math.min(cursor ?? firstOpenPosition(run), run.items.length);
}

export function isSummary(run: RunView, cursor: number | null): boolean {
  return run.finished || positionOf(run, cursor) >= run.items.length;
}

export function isLastPosition(run: RunView, position: number): boolean {
  return position >= run.items.length - 1;
}
