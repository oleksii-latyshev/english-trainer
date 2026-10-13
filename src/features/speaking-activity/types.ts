import type { IpcDecodeError, IpcError, SpeakingActivitySchema } from '@/core/ipc';

export type SpeakingActivitySnapshot = typeof SpeakingActivitySchema.Type;

export type SpeakingActivityFailure = IpcError | IpcDecodeError;
