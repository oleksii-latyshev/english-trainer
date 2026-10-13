import type { LearningStatus } from '@/lib/learningTypes';
import { tv } from '@/shared/ui/tv';

const statusChip = tv({
  slots: {
    root: 'inline-flex w-max items-center gap-1.5 rounded-full border border-line px-2.5 py-0.75 font-medium text-xs',
    dot: 'block size-1.5 rounded-full bg-faint',
  },
  variants: {
    status: {
      new: { dot: 'bg-accent' },
      learning: { dot: 'bg-warn' },
      improving: { dot: 'bg-me' },
      stable: { dot: 'bg-ok' },
      archived: {},
    },
  },
});

export function StatusChip({ status }: { status: LearningStatus }) {
  const { root, dot } = statusChip({ status });
  return (
    <span className={root()} data-status={status}>
      <i aria-hidden="true" className={dot()} />
      {status}
    </span>
  );
}
