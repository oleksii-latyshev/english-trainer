import type {
  AttemptComparisonSchema,
  FinishedSessionSchema,
  IpcDecodeError,
  IpcError,
  PracticeModeSchema,
  PracticePhaseSchema,
  PracticeSessionSchema,
} from '@/core/ipc';

export type PracticeMode = typeof PracticeModeSchema.Type;

export type PracticePhase = typeof PracticePhaseSchema.Type;

export type AttemptComparison = typeof AttemptComparisonSchema.Type;

export type PracticeSession = typeof PracticeSessionSchema.Type;

export type FinishedSession = typeof FinishedSessionSchema.Type;

export type PracticeFailure = IpcError | IpcDecodeError;

export type DurationGoalSeconds = 300 | 600 | 900;

export type StartOptions = {
  readonly topic_id: string;
  readonly topic_custom: string | null;
  readonly duration_goal_seconds: DurationGoalSeconds;
  readonly practice_mode?: PracticeMode;
};

export type SessionDetails = {
  readonly sessionId: number;
  readonly question: string;
  readonly turnCount: number;
  readonly targetTurns: number;
  readonly retryEvidence: readonly AttemptComparison[];
  readonly topicId: string;
  readonly topicLabel: string;
  readonly topicCustom: string | null;
  readonly durationGoalSeconds: number;
  readonly activeDurationMs: number;
  readonly startedAt: number;
  readonly isClockRunning: boolean;
  readonly clockSnapshotAtMs: number;
  readonly practiceMode: PracticeMode;
  readonly practicePhase: PracticePhase;
  readonly writtenTurnCount: number;
  readonly spokenTurnCount: number;
  readonly isMistakePractice: boolean;
};

export type PracticeState =
  | { readonly tag: 'idle' }
  | { readonly tag: 'loading' }
  | { readonly tag: 'starting' }
  | { readonly tag: 'completed'; readonly summary: FinishedSession }
  | ({ readonly tag: 'active' | 'waiting' | 'finishing' } & SessionDetails);
