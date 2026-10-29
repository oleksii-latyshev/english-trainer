export type MistakeRunScreenProps = {
  readonly runId: number;
  readonly micBlockedReason: string | null;
  readonly onLeave: () => void;
};
