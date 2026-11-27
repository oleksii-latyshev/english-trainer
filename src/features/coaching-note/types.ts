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

export type DebriefWord = ReviewedConversation['debrief_words'][number];

export type DebriefWin = ReviewedConversation['debrief_wins'][number];

export type Habit = ReviewedConversation['habits'][number];

export type AttemptComparison = typeof AttemptComparisonSchema.Type;

export type PhraseCheck = AttemptComparison['words_to_take'][number];

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
