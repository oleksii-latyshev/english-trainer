export type PrimaryAction = 'restoring' | 'resume' | 'starting' | 'start';

export function primaryAction(state: {
  isRestoring: boolean;
  isBusy: boolean;
  hasActiveSession: boolean;
}): PrimaryAction {
  if (state.isRestoring) return 'restoring';
  if (state.hasActiveSession) return 'resume';
  if (state.isBusy) return 'starting';
  return 'start';
}

export const PRIMARY_ACTION_LABEL: Record<PrimaryAction, string> = {
  restoring: 'Restoring your conversation…',
  resume: 'Resume talking',
  starting: 'Starting…',
  start: 'Start talking',
};

export function resumeDetail(session: { turnCount: number; targetTurns: number }): string {
  return `${session.turnCount} of ${session.targetTurns} answers so far`;
}

export function reviewTitle(dueCount: number): string {
  return dueCount > 0 ? `Phrases to review today: ${dueCount}` : 'Nothing to review today';
}

export function reviewHint(dueCount: number): string {
  return dueCount > 0
    ? 'A short spoken review keeps them fresh.'
    : 'Phrases you save while talking will come back here.';
}
