import type { CaptureView } from '@/features/speech/useSpeechCapture';
import type { ConversationTurn } from '@/lib/types';
import type { PracticeState } from './lib/practiceState';

export type PracticeViewModel = CaptureView & {
  practice: PracticeState;
  practiceError: string;
  busy: boolean;
};

export type PracticeActions = {
  startRecording: () => void;
  stopRecording: () => void;
  transcribeRecording: () => void;
  startPractice: () => void;
  finishPractice: () => void;
  handlePracticeTurn: (sessionId: number, turn: ConversationTurn) => void;
  isCurrent: () => boolean;
  onTurnPendingChange: (isPending: boolean) => void;
};
