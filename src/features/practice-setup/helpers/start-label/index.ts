import type { PracticeMode, StartStatus } from '../../types';

const READY_LABEL: Record<PracticeMode, string> = {
  voice: 'Start talking',
  text_chat: 'Start text chat',
  write_then_speak: 'Start writing',
};

export function startLabel(mode: PracticeMode, status: StartStatus): string {
  if (status === 'restoring') return 'Restoring your conversation…';
  if (status === 'starting') return 'Starting…';
  return READY_LABEL[mode];
}
