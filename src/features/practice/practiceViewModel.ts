import type { CaptureView } from '@/features/speech/useSpeechCapture';
import type { AttemptComparison, ConversationTurn } from '@/lib/types';
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
  /** Listening that starts by itself after the AI finished speaking. */
  startAutoListen: () => void;
  /** Abandons listening or recording without sending. */
  cancelRecording: () => void;
  /** "Keep listening": the turn does not end by silence while held. */
  holdListening: (held: boolean) => void;
  pauseMic: () => void;
  resumeMic: () => void;
  transcribeRecording: () => void;
  resetCapture: () => void;
  startPractice: () => void;
  finishPractice: () => void;
  handlePracticeTurn: (sessionId: number, turn: ConversationTurn) => void;
  handleRetryComparison: (sessionId: number, comparison: AttemptComparison) => void;
  isCurrent: () => boolean;
  onTurnPendingChange: (isPending: boolean) => void;
};
