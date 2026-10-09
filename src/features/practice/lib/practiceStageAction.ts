import type { PracticeMode, PracticePhase } from '@/lib/practiceOptions';

export type PracticeStageAction = {
  label: 'Review writing' | 'Review speaking';
  onPress: () => void;
  isDisabled: boolean;
};

export function practiceStageAction({
  mode,
  phase,
  writtenCount,
  spokenCount,
  isDisabled,
  transition,
}: {
  mode: PracticeMode;
  phase: PracticePhase;
  writtenCount: number;
  spokenCount: number;
  isDisabled: boolean;
  transition: (phase: PracticePhase) => void;
}): PracticeStageAction | undefined {
  if (phase === 'writing' && writtenCount > 0) {
    return {
      label: 'Review writing',
      onPress: () => transition('writing_review'),
      isDisabled,
    };
  }
  if (mode === 'write_then_speak' && phase === 'speaking' && spokenCount === writtenCount) {
    return {
      label: 'Review speaking',
      onPress: () => transition('speaking_review'),
      isDisabled,
    };
  }
  return undefined;
}
