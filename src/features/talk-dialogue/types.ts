import type {
  IpcDecodeError,
  IpcError,
  PracticeDialogueSchema,
  TurnCoachingSchema,
} from '@/core/ipc';

export type PracticeDialogue = typeof PracticeDialogueSchema.Type;

export type TurnCoaching = typeof TurnCoachingSchema.Type;

export type DialogueFailure = IpcError | IpcDecodeError;

export type DialogueView = {
  readonly dialogue: PracticeDialogue | null;
  readonly hasFailed: boolean;
};
