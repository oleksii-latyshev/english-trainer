import type { EntryRef } from '@/features/memory-library';

export type MemoryScreenProps = {
  readonly isAudioBusy: boolean;
  readonly isSessionOpen: boolean;
  readonly isStartingMistakePractice: boolean;
  readonly mistakePracticeError: string;
  readonly onSayNow: (ref: EntryRef) => void;
  readonly onStartReview: () => void;
  readonly onStartMistakePractice: () => void;
};
