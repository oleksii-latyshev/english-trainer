export type MemoryScreenProps = {
  readonly isAudioBusy: boolean;
  readonly isSessionOpen: boolean;
  readonly isStartingMistakePractice: boolean;
  readonly mistakePracticeError: string;
  readonly onStartReview: () => void;
  readonly onStartMistakePractice: () => void;
};
