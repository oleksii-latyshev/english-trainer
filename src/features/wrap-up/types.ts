import type {
  FinishedSessionSchema,
  IpcDecodeError,
  IpcError,
  PhraseCardRecordSchema,
  SessionNumbersSchema,
  TrendSchema,
  WrapupPhraseSchema,
} from '@/core/ipc';

export type FinishedSession = typeof FinishedSessionSchema.Type;

export type SessionNumbers = typeof SessionNumbersSchema.Type;

export type Trend = typeof TrendSchema.Type;

export type WrapupPhrase = typeof WrapupPhraseSchema.Type;

export type PhraseCard = typeof PhraseCardRecordSchema.Type;

export type WrapUpFailure = IpcError | IpcDecodeError;

export type TakenWord = {
  readonly sessionId: number;
  readonly sequence: number;
  readonly phrase: string;
  readonly meaning: string;
};
