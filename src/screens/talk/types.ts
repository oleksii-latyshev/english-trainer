import type { ReactNode } from 'react';

export type TalkScreenProps = {
  readonly onStartPractice: () => void;
  readonly onOpenSettings: () => void;
  readonly onChooseMicrophone: () => void;
  readonly moodExtras: { readonly isHelpOpen: boolean };
  readonly isFinishBlocked: boolean;
  readonly lockedReason?: string;
  readonly helpBar?: ReactNode;
  readonly rescueControl?: ReactNode;
  readonly replayPrompt?: ReactNode;
  readonly dialogueExtras?: ReactNode;
  readonly reviewStage?: ReactNode;
};
