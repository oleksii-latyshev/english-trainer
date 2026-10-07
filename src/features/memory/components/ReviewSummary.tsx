import { Button } from '@heroui/react';
import '@/features/memory/reviewSummary.css';
import type {
  ReviewSummary as Summary,
  SummaryEntry,
} from '@/features/memory/lib/memoryRecallState';

type Props = {
  summary: Summary;
  onStartTalk: () => void;
  onBackToMemory: () => void;
};

function outcomeText(entry: SummaryEntry): string {
  if (entry.outcome === 'used') return entry.status ? `Used it → ${entry.status}` : 'Used it';
  return entry.outcome === 'skipped' ? 'Skipped' : 'Not yet';
}

/** The end of a review: one line per item, with its outcome and new status. */
export function ReviewSummary({ summary, onStartTalk, onBackToMemory }: Props) {
  return (
    <div className="review-summary">
      <h2>Review done</h2>
      <p className="review-summary-headline">{summary.headline}</p>
      <ul className="review-summary-list">
        {summary.entries.map((entry) => (
          <li data-outcome={entry.outcome} key={entry.key}>
            <span className="review-summary-phrase">{entry.label}</span>
            <span className="review-summary-outcome">{outcomeText(entry)}</span>
          </li>
        ))}
      </ul>
      <div className="review-summary-actions">
        <Button onPress={onStartTalk} variant="primary">
          Start a conversation
        </Button>
        <Button onPress={onBackToMemory} variant="secondary">
          Back to Memory
        </Button>
      </div>
    </div>
  );
}
