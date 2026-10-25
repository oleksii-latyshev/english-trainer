import type { FinishedSession } from '@/features/wrap-up';

export type WrapUpScreenProps = {
  readonly summary: FinishedSession;
  readonly onDone: () => void;
  readonly onTalkMore: () => void;
};
