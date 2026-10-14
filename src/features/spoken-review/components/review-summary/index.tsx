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
    <section className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-6 shadow-overlay backdrop-blur-glass backdrop-saturate-170">
      <h2 className="m-0 font-bold text-2xl tracking-tight">Review done</h2>
      <p className="m-0 text-muted">{summary.headline}</p>
      <ul className="m-0 flex list-none flex-col border-line-soft border-t p-0">
        {summary.entries.map((entry) => (
          <li
            className="flex justify-between gap-3 border-line-soft border-b py-2.25"
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
