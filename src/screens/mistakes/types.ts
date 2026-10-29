export type MistakesScreenProps = {
  readonly talkBlockedReason: string | null;
  readonly isStartingTalk: boolean;
  readonly talkError: string;
  readonly onTalkItThrough: () => void;
  readonly onOpenMistake: (id: number) => void;
};

export type MistakeCardScreenProps = {
  readonly mistakeId: number;
  readonly onBack: () => void;
};
