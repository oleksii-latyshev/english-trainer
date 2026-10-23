import { Data } from 'effect';
import type { IpcDecodeError, IpcError } from '@/core/ipc';
import type { InputSource } from '@/core/practice-session';

export type SendFailure = {
  readonly message: string;
  readonly needsSetup: boolean;
  readonly isUnresponsive: boolean;
};

export class TurnBlocked extends Data.TaggedError('TurnBlocked')<{
  readonly reason: 'busy' | 'stage' | 'empty';
}> {}

export type TurnFailure = IpcError | IpcDecodeError;

export type SendInput = {
  readonly text: string;
  readonly source: InputSource;
  readonly recordingMs: number;
};

export type SentAnswer = {
  readonly sessionId: number;
  readonly sequence: number;
  readonly originalTranscript: string;
  readonly requestId: number;
};

export type PendingReply = {
  readonly sessionId: number;
  readonly text: string;
  readonly savedTurnCount: number;
};
