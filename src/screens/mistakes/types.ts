import type { RunTarget } from '@/core/mistakes';

export type MistakesScreenProps = {
  readonly talkBlockedReason: string | null;
  readonly isStartingTalk: boolean;
  readonly isStartingRun: boolean;
  readonly talkError: string;
  readonly onTalkItThrough: () => void;
  readonly onOpenMistake: (id: number) => void;
  readonly onPractise: (target: RunTarget) => void;
};

export type MistakeCardScreenProps = {
  readonly mistakeId: number;
  readonly isStartingRun: boolean;
  readonly onBack: () => void;
  readonly onPractise: (target: RunTarget) => void;
};
