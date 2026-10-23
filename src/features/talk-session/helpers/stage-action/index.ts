import type { PracticeMode, PracticePhase } from '@/core/practice-session';

export type StageActionKind = {
  label: 'Review writing' | 'Review speaking';
  target: PracticePhase;
};

type Stage = {
  mode: PracticeMode;
  phase: PracticePhase;
  writtenCount: number;
  spokenCount: number;
};

export function stageActionFor({
  mode,
  phase,
  writtenCount,
  spokenCount,
}: Stage): StageActionKind | undefined {
  if (phase === 'writing' && writtenCount > 0) {
    return { label: 'Review writing', target: 'writing_review' };
  }
  if (mode === 'write_then_speak' && phase === 'speaking' && spokenCount === writtenCount) {
    return { label: 'Review speaking', target: 'speaking_review' };
  }
  return undefined;
}
