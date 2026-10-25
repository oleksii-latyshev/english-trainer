import type { AnswerPlanSchema, IpcDecodeError, IpcError } from '@/core/ipc';
import type { HelpLevel } from './helpers/help-levels';

export type HelpPlan = typeof AnswerPlanSchema.Type;

export type HelpFailure = IpcError | IpcDecodeError;

export type HelpTarget = {
  readonly sessionId: number;
  readonly sequence: number;
  readonly question: string;
  readonly key: string;
};

export type PlanState =
  | { readonly tag: 'loading'; readonly key: string }
  | { readonly tag: 'ready'; readonly key: string; readonly plan: HelpPlan }
  | { readonly tag: 'failed'; readonly key: string; readonly failure: HelpFailure };

export type HelpChoice = { readonly key: string; readonly level: HelpLevel | null };

export type HelpNotice = { readonly key: string; readonly text: string };

export type PlanRequest = { readonly target: HelpTarget; readonly retry: boolean };

export type OpenRequest = {
  readonly level: HelpLevel;
  readonly target: HelpTarget;
  readonly request: number;
  readonly captureEpoch: number;
  readonly wasCapturing: boolean;
};

export type PlanningSeconds = 15 | 30;

export type PlanningTimer = {
  readonly durationSeconds: PlanningSeconds;
  readonly startedAt: number;
};
