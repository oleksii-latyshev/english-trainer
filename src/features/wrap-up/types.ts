import type {
  FinishedSessionSchema,
  IpcDecodeError,
  IpcError,
  PhraseCardRecordSchema,
  SavedWrapupPhrasesSchema,
  SessionNumbersSchema,
  TrendSchema,
  WrapupPhraseSchema,
  WrapupPreparationSchema,
} from '@/core/ipc';

export type FinishedSession = typeof FinishedSessionSchema.Type;

export type SessionNumbers = typeof SessionNumbersSchema.Type;

export type Trend = typeof TrendSchema.Type;

export type WrapupPhrase = typeof WrapupPhraseSchema.Type;

export type WrapupPreparation = typeof WrapupPreparationSchema.Type;

export type PhraseCard = typeof PhraseCardRecordSchema.Type;

export type SavedPhrases = typeof SavedWrapupPhrasesSchema.Type;

export type WrapUpFailure = IpcError | IpcDecodeError;

export type SaveState = 'idle' | 'saving' | 'error';

export type PhraseSelection = {
  readonly removed: ReadonlySet<string>;
  readonly saved: ReadonlySet<string>;
};

export type AnswerPhrase = {
  readonly sessionId: number;
  readonly sequence: number;
  readonly phrase: string;
  readonly note: string;
};

export type AnswerFeedback = {
  readonly focus_feedback: readonly { readonly improved: string; readonly explanation: string }[];
  readonly b2_rewrite: string;
};
