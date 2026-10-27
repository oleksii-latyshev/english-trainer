import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { type SummaryEntry, statusLabel, summarizeReview } from '../../helpers/review-summary';
import { sessionAtom } from '../../model/session-atoms';
import { outcomeTone } from './styles';

type Props = {
  onStartTalk: () => void;
  onBackToMemory: () => void;
};

function outcomeText(entry: SummaryEntry): string {
  if (entry.outcome === 'used')
    return entry.status ? `Used it → ${statusLabel(entry.status)}` : 'Used it';
  return entry.outcome === 'skipped' ? 'Skipped' : 'Not yet';
}

export function ReviewSummary({ onStartTalk, onBackToMemory }: Props) {
  const session = useAtomValue(sessionAtom);
  if (session === null) return null;
  const summary = summarizeReview(session.run.items);

  return (
    <section className="rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass flex flex-col gap-3.5 border p-6 backdrop-saturate-170">
      <h2 className="m-0 text-2xl font-bold tracking-tight">Review done</h2>
      <p className="text-muted m-0">{summary.headline}</p>
      <ul className="border-line-soft m-0 flex list-none flex-col border-t p-0">
        {summary.entries.map((entry) => (
          <li
            className="border-line-soft flex justify-between gap-3 border-b py-2.25"
            data-outcome={entry.outcome}
            key={entry.key}
          >
            <span className="font-semibold">{entry.label}</span>
            <span className={outcomeTone({ outcome: entry.outcome })}>{outcomeText(entry)}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button onClick={onStartTalk} size="sm" tone="primary">
          Start a conversation
        </Button>
        <Button onClick={onBackToMemory} tone="secondary">
          Back to Memory
        </Button>
      </div>
    </section>
  );
}
