export type PipState = 'done' | 'current' | 'ahead';

export function pipStateOf(index: number, position: number | null): PipState {
  if (position === null || index < position - 1) return 'done';
  return index === position - 1 ? 'current' : 'ahead';
}

export function progressLabel(position: number | null, total: number): string {
  return position === null ? 'Done' : `${position} of ${total}`;
}

export function endLabelOf({ isWarmup, isDone }: { isWarmup: boolean; isDone: boolean }): string {
  if (isWarmup) return isDone ? 'Start conversation' : 'Skip and start conversation';
  return isDone ? 'Back to Memory' : 'End review';
}
