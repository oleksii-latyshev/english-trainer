import type { ActiveReview } from '@/features/memory-practice';

export type MemoryScreenProps = {
  readonly activeReview: ActiveReview;
  readonly isAudioBusy: boolean;
  readonly isSessionOpen: boolean;
  readonly isStartingMistakePractice: boolean;
  readonly mistakePracticeError: string;
  readonly onStartReview: () => void;
  readonly onStartMistakePractice: () => void;
};
