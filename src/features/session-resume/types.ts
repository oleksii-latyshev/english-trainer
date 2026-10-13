export type OpenSession = {
  readonly topicLabel: string;
  readonly startedAt: number;
  readonly durationGoalSeconds: number;
  readonly activeDurationMs: number;
  readonly isMistakePractice?: boolean;
  readonly turnCount?: number;
  readonly targetTurns?: number;
};
