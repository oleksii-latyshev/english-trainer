import type { IpcDecodeError, IpcError, PracticeDialogueSchema } from '@/core/ipc';

export type PracticeDialogue = typeof PracticeDialogueSchema.Type;

export type DialogueFailure = IpcError | IpcDecodeError;

export type DialogueView = {
  readonly dialogue: PracticeDialogue | null;
  readonly hasFailed: boolean;
};
