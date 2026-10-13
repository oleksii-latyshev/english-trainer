import { useAtomSet } from '@effect/atom-react';
import { Archive, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { categoryLabel, gapLabel, nextReviewLabel } from '../../helpers/library-copy';
import { entryLabel, entryRef, entryStatus } from '../../helpers/memory-entries';
import { archiveEntryAtom, pendingDeleteAtom } from '../../model/atoms';
import type { MemoryEntry } from '../../types';
import { EvidenceList } from '../evidence-list';

type Props = { entry: MemoryEntry; now: number };

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <>
      <dt className="text-faint">{term}</dt>
      <dd className="m-0">{children}</dd>
    </>
  );
}

export function EntryDetail({ entry, now }: Props) {
  const archive = useAtomSet(archiveEntryAtom);
  const askDelete = useAtomSet(pendingDeleteAtom);
  const item = entry.kind === 'phrase' ? entry.card : entry.mistake;
  const label = entryLabel(entry);
  const isArchived = entryStatus(entry) === 'archived';

  return (
    <div className="grid grid-cols-[16rem_minmax(0,1fr)_auto] items-start gap-6 px-5 pb-4 max-narrow:grid-cols-1">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-caption">
        <Fact term="Next review">{nextReviewLabel(item.next_review_at, item.status, now)}</Fact>
        <Fact term="Gap between reviews">{gapLabel(item.interval_days)}</Fact>
        {entry.kind === 'mistake' && (
          <Fact term="Kind">{categoryLabel(entry.mistake.category)}</Fact>
        )}
      </dl>
      <div className="flex flex-col gap-2">
        <EvidenceList entryRef={entryRef(entry)} />
        {entry.kind === 'mistake' && entry.mistake.explanation && (
          <p className="mt-0.5 mb-0 text-caption text-muted leading-copy" data-word-lookup>
            {entry.mistake.explanation}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {!isArchived && (
          <Button
            aria-label={`Archive ${label}`}
            iconOnly
            onClick={() => archive(entry)}
            size="sm"
            tone="secondary"
          >
            <Archive aria-hidden="true" />
          </Button>
        )}
        <Button
          aria-label={`Delete ${label}`}
          iconOnly
          onClick={() => askDelete(entry)}
          size="sm"
          tone="secondary"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
