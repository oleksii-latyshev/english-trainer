import type {
  AttemptComparisonSchema,
  IpcDecodeError,
  IpcError,
  PracticeDialogueSchema,
  TurnCoachingSchema,
  TurnFeedbackSchema,
} from '@/core/ipc';

export type TurnCoaching = typeof TurnCoachingSchema.Type;

export type TurnFeedback = typeof TurnFeedbackSchema.Type;

export type AttemptComparison = typeof AttemptComparisonSchema.Type;

export type ReviewedConversation = typeof PracticeDialogueSchema.Type;

export type CoachingNoteFailure = IpcError | IpcDecodeError;

export type AnswerTarget = {
  readonly sessionId: number;
  readonly sequence: number;
};

export type SayAgainView =
  | { readonly tag: 'idle' }
  | { readonly tag: 'busy' }
  | { readonly tag: 'requesting' }
  | { readonly tag: 'capturing' }
  | { readonly tag: 'transcribing' }
  | { readonly tag: 'comparing' }
  | {
      readonly tag: 'failed';
      readonly message: string;
      readonly canRetryTranscription: boolean;
    };
