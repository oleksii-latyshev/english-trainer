import { ChevronDown, Sun } from 'lucide-react';
import { type MouseEvent, useId } from 'react';
import {
  isDueToday,
  mistakeSourceLine,
  nextReviewLabel,
  phraseSourceLine,
  statusLabel,
} from '../../helpers/library-copy';
import { usedOnOwnCount } from '../../helpers/memory-entries';
import { isSelectingInside } from '../../helpers/text-selection';
import type { MemoryEntry } from '../../types';
import { EntryDetail } from '../entry-detail';
import { StatusDot } from '../status-dot';
import { memoryRow } from './styles';

type Props = {
  entry: MemoryEntry;
  isOpen: boolean;
  now: number;
  onToggle: () => void;
};

function EntryText({ entry }: { entry: MemoryEntry }) {
  if (entry.kind === 'phrase') {
    return (
      <span className="text-body font-semibold" data-word-lookup>
        {entry.card.phrase}
      </span>
    );
  }
  return (
    <span className="text-body" data-word-lookup>
      <s className="text-faint decoration-warn/80">{entry.mistake.original_example}</s>{' '}
      <span className="text-faint">→</span>{' '}
      <span className="text-ok-text font-semibold">{entry.mistake.corrected_example}</span>
    </span>
  );
}

export function MemoryRow({ entry, isOpen, now, onToggle }: Props) {
  const detailId = useId();
  const item = entry.kind === 'phrase' ? entry.card : entry.mistake;
  const source =
    entry.kind === 'phrase' ? phraseSourceLine(entry.card, now) : mistakeSourceLine(entry.mistake);
  const ownCount = usedOnOwnCount(entry);
  const isDue = isDueToday(item.next_review_at, item.status, now);
  const { item: itemClass, toggle, chevron } = memoryRow({ isOpen });

  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    const isKeyboard = event.detail === 0;
    if (!isKeyboard && isSelectingInside(event.currentTarget)) {
      event.preventDefault();
      return;
    }
    onToggle();
  }

  return (
    <li className={itemClass()}>
      <button
        aria-controls={detailId}
        aria-expanded={isOpen}
        className={toggle()}
        onClick={handleToggle}
        type="button"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <EntryText entry={entry} />
          <span className="text-faint text-xs" data-word-lookup>
            {source}
          </span>
        </span>
        <span className="text-caption text-quiet-foreground flex items-center gap-1.5">
          <StatusDot status={item.status} />
          {statusLabel(item.status)}
        </span>
        <span
          className={
            isDue
              ? 'text-accent-text text-caption font-semibold'
              : 'text-caption text-quiet-foreground'
          }
        >
          {nextReviewLabel(item.next_review_at, item.status, now)}
        </span>
        <span className="text-caption text-quiet-foreground flex items-center gap-1.5">
          <Sun
            aria-hidden="true"
            className={ownCount > 0 ? 'text-warn size-4' : 'text-faint size-4 opacity-60'}
          />
          {ownCount}
        </span>
        <span className="text-faint flex justify-center">
          <ChevronDown aria-hidden="true" className={chevron()} />
        </span>
      </button>
      <div hidden={!isOpen} id={detailId}>
        {isOpen && <EntryDetail entry={entry} now={now} />}
      </div>
    </li>
  );
}
