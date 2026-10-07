import type { CaptureView } from '@/features/speech/useSpeechCapture';
import type { AttemptComparison, ConversationTurn, SessionMode, TurnFeedback } from '@/lib/types';
import type { InputSource } from './lib/inputSource';
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
  startPractice: (mode?: SessionMode) => void;
  finishPractice: () => void;
  handlePracticeTurn: (sessionId: number, transcript: string, turn: ConversationTurn) => void;
  saveCoachAnswer: (
    sessionId: number,
    transcript: string,
    inputSource?: InputSource,
    answerDurationMs?: number,
  ) => Promise<unknown>;
  continueCoachTurn: (
    sessionId: number,
    sequence: number,
    onDelta?: (text: string) => void,
  ) => Promise<ConversationTurn>;
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
