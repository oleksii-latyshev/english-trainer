import { Button } from '@heroui/react';
import { Archive, ChevronDown, Trash2 } from 'lucide-react';
import { type MouseEvent, useId } from 'react';
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
  if (entry.kind === 'phrase')
    return (
      <span className="memory-phrase" data-word-lookup>
        {entry.card.phrase}
      </span>
    );
  return (
    <span className="memory-mistake" data-word-lookup>
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
        <p className="memory-explanation" data-word-lookup>
          {entry.mistake.explanation}
        </p>
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

  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) {
      onToggle();
      return;
    }
    const selection = window.getSelection();
    const rowButton = event.currentTarget;
    if (
      selection &&
      !selection.isCollapsed &&
      selection.anchorNode &&
      selection.focusNode &&
      rowButton.contains(selection.anchorNode) &&
      rowButton.contains(selection.focusNode)
    ) {
      event.preventDefault();
      return;
    }
    onToggle();
  }

  return (
    <li className="memory-item">
      <div className="memory-row">
        <button
          aria-controls={detailId}
          aria-expanded={isOpen}
          className="memory-row-main"
          onClick={handleToggle}
          type="button"
        >
          <span className="memory-row-title">
            <EntryText entry={entry} />
            <ChevronDown aria-hidden="true" className="memory-row-chevron" size={16} />
          </span>
          <span className="memory-source" data-word-lookup>
            {source}
          </span>
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
