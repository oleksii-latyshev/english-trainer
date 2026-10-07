import type { LearningStatus } from '@/lib/learningTypes';
import '@/features/memory/memoryDetail.css';

/** The status as the design draws it: a coloured dot and the plain word. */
export function StatusChip({ status }: { status: LearningStatus }) {
  return (
    <span className="status-chip" data-status={status}>
      <i aria-hidden="true" />
      {status}
    </span>
  );
}
