import type { PracticeOptions, StartStatus } from '@/features/practice-setup';
import type { WarmupPhrase } from '@/features/review-warmup';
import type { OpenSession } from '@/features/session-resume';

export type ReviewSummary = {
  readonly dueCount: number;
  readonly nextPhrase: WarmupPhrase | undefined;
};

export type TalkStartScreenProps = {
  readonly learnerName: string;
  readonly status: StartStatus;
  readonly error: string;
  readonly openSession: OpenSession | undefined;
  readonly review: ReviewSummary | undefined;
  readonly onStart: (options: PracticeOptions) => void;
  readonly onStartWarmup: (options: PracticeOptions) => void;
  readonly onContinue: () => void;
  readonly onOpenMemory: () => void;
  readonly onOpenMistakes: () => void;
};
