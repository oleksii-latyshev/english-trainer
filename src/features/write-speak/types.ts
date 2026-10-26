import type { ReactNode } from 'react';
import type { PracticeDialogueSchema, TurnCoachingSchema } from '@/core/ipc';

export type WriteSpeakDialogue = typeof PracticeDialogueSchema.Type;

export type AnswerCoaching = typeof TurnCoachingSchema.Type;

export type ReviewedAnswerRef = {
  readonly sessionId: number;
  readonly sequence: number;
  readonly transcript: string;
  readonly coaching: AnswerCoaching;
};

export type RenderAnswerReview = (answer: ReviewedAnswerRef) => ReactNode;

export type FeedbackCounts = {
  readonly ready: number;
  readonly pending: number;
  readonly paused: number;
  readonly unavailable: number;
};
