import { Button } from '@heroui/react';
import { Archive, ChevronDown, Trash2 } from 'lucide-react';
import { useId } from 'react';
import {
  formatDueText,
  mistakeSourceLine,
  phraseSourceLine,
} from '@/features/memory/lib/memoryState';
import type { MistakeRecord, PhraseCardRecord } from '@/lib/learningTypes';
import '@/features/memory/memoryDetail.css';
import { StatusChip } from './StatusChip';
import { UsageEvidenceSection } from './UsageEvidenceSection';

export type MemoryEntry =
  | { kind: 'phrase'; card: PhraseCardRecord }
  | { kind: 'mistake'; mistake: MistakeRecord };

/** The words that name an entry in buttons and dialogs. */
export function entryLabel(entry: MemoryEntry): string {
  return entry.kind === 'phrase'
    ? entry.card.phrase
    : `${entry.mistake.original_example} → ${entry.mistake.corrected_example}`;
}

type Props = {
  entry: MemoryEntry;
  isOpen: boolean;
  onToggle: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

function EntryText({ entry }: { entry: MemoryEntry }) {
  if (entry.kind === 'phrase') return <span className="memory-phrase">{entry.card.phrase}</span>;
  return (
    <span className="memory-mistake">
      <span className="memory-strike">{entry.mistake.original_example}</span> →{' '}
      <span className="memory-hl">{entry.mistake.corrected_example}</span>
    </span>
  );
}

function EntryDetail({ entry }: { entry: MemoryEntry }) {
  const item = entry.kind === 'phrase' ? entry.card : entry.mistake;
  const days = item.interval_days === 1 ? '1 day' : `${item.interval_days} days`;
  return (
    <div className="memory-detail">
      <dl className="memory-facts">
        <div>
          <dt>Next review</dt>
          <dd>{formatDueText(item.next_review_at)}</dd>
        </div>
        <div>
          <dt>Gap between reviews</dt>
          <dd>{days}</dd>
        </div>
        {entry.kind === 'mistake' && (
          <div>
            <dt>Kind</dt>
            <dd>{entry.mistake.category}</dd>
          </div>
        )}
      </dl>
      {entry.kind === 'mistake' && entry.mistake.explanation && (
        <p className="memory-explanation">{entry.mistake.explanation}</p>
      )}
      <UsageEvidenceSection
        itemId={item.id}
        itemType={entry.kind === 'phrase' ? 'phrase' : 'mistake'}
      />
    </div>
  );
}

export function MemoryRow({ entry, isOpen, onToggle, onArchive, onDelete }: Props) {
  const detailId = useId();
  const item = entry.kind === 'phrase' ? entry.card : entry.mistake;
  const source =
    entry.kind === 'phrase' ? phraseSourceLine(entry.card) : mistakeSourceLine(entry.mistake);
  const label = entryLabel(entry);

  return (
    <li className="memory-item">
      <div className="memory-row">
        <button
          aria-controls={detailId}
          aria-expanded={isOpen}
          className="memory-row-main"
          onClick={onToggle}
          type="button"
        >
          <span className="memory-row-title">
            <EntryText entry={entry} />
            <ChevronDown aria-hidden="true" className="memory-row-chevron" size={16} />
          </span>
          <span className="memory-source">{source}</span>
        </button>
        <StatusChip status={item.status} />
        <div className="memory-actions">
          <Button
            aria-label={`Archive ${label}`}
            isIconOnly
            onPress={onArchive}
            size="sm"
            variant="ghost"
          >
            <Archive aria-hidden="true" size={16} />
          </Button>
          <Button
            aria-label={`Delete ${label}`}
            isIconOnly
            onPress={onDelete}
            size="sm"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>
      <div hidden={!isOpen} id={detailId}>
        {isOpen && <EntryDetail entry={entry} />}
      </div>
    </li>
  );
}
