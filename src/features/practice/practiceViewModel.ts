import type { CaptureView } from '@/features/speech/useSpeechCapture';
import type { AttemptComparison, ConversationTurn, SessionMode, TurnFeedback } from '@/lib/types';
import type { PracticeState } from './lib/practiceState';

export type PracticeViewModel = CaptureView & {
  practice: PracticeState;
  practiceError: string;
  busy: boolean;
  canChangeSession: boolean;
};

export type PracticeActions = {
  startRecording: () => void;
  stopRecording: () => void;
  transcribeRecording: () => void;
  resetCapture: () => void;
  startPractice: (mode?: SessionMode) => void;
  finishPractice: () => void;
  handlePracticeTurn: (sessionId: number, transcript: string, turn: ConversationTurn) => void;
  saveCoachAnswer: (sessionId: number, transcript: string) => Promise<unknown>;
  continueCoachTurn: (sessionId: number, sequence: number) => Promise<ConversationTurn>;
  saveFeedback: (
    sessionId: number,
    sequence: number,
    transcript: string,
    feedback: TurnFeedback,
  ) => Promise<void>;
  handleRetryComparison: (sessionId: number, comparison: AttemptComparison) => void;
  isCurrent: () => boolean;
  onTurnPendingChange: (isPending: boolean) => void;
};
