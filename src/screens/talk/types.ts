import type { ReactNode } from 'react';
import type { DialogueMessage } from '@/features/talk-dialogue';

export type TalkScreenProps = {
  readonly onStartPractice: () => void;
  readonly onOpenSettings: () => void;
  readonly onChooseMicrophone: () => void;
  readonly moodExtras: { readonly isPhraseSaved: boolean; readonly isHelpOpen: boolean };
  readonly isFinishBlocked: boolean;
  readonly lockedReason?: string;
  readonly helpBar?: ReactNode;
  readonly rescueControl?: ReactNode;
  readonly replayPrompt?: ReactNode;
  readonly dialogueExtras?: ReactNode;
  readonly reviewStage?: ReactNode;
  readonly renderNote?: (message: DialogueMessage) => ReactNode;
};
