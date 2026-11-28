import type { FinishedSessionPageSchema, IpcDecodeError, IpcError } from '@/core/ipc';

export type ConversationPage = typeof FinishedSessionPageSchema.Type;

export type ConversationItem = ConversationPage['sessions'][number];

export type ConversationHistoryFailure = IpcError | IpcDecodeError;
