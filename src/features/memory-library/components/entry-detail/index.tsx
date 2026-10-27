import { useAtomSet } from '@effect/atom-react';
import { Archive, Mic, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { gapLabel, kindLabel, nextReviewLabel } from '../../helpers/library-copy';
import { entryLabel, entryRef, entryStatus } from '../../helpers/memory-entries';
import { archiveEntryAtom, pendingDeleteAtom } from '../../model/atoms';
import type { MemoryEntry, SayNow } from '../../types';
import { EvidenceList } from '../evidence-list';

type Props = { entry: MemoryEntry; now: number; sayNow: SayNow };

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <>
      <dt className="text-faint">{term}</dt>
      <dd className="m-0">{children}</dd>
    </>
  );
}

export function EntryDetail({ entry, now, sayNow }: Props) {
  const archive = useAtomSet(archiveEntryAtom);
  const askDelete = useAtomSet(pendingDeleteAtom);
  const item = entry.kind === 'phrase' ? entry.card : entry.mistake;
  const label = entryLabel(entry);
  const isArchived = entryStatus(entry) === 'archived';

  return (
    <div className="max-narrow:grid-cols-1 grid grid-cols-[16rem_minmax(0,1fr)_auto] items-start gap-6 px-5 pb-4">
      <dl className="text-caption m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5">
        <Fact term="Next review">{nextReviewLabel(item.next_review_at, item.status, now)}</Fact>
        <Fact term="Gap between reviews">{gapLabel(item.interval_days)}</Fact>
        <Fact term="Kind">{kindLabel(entry)}</Fact>
      </dl>
      <div className="flex flex-col gap-2">
        <EvidenceList entryRef={entryRef(entry)} />
        {entry.kind === 'mistake' && entry.mistake.explanation && (
          <p className="text-caption text-muted leading-copy mt-0.5 mb-0" data-word-lookup>
            {entry.mistake.explanation}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isArchived && (
          <Button
            disabled={sayNow.isDisabled}
            onClick={() => sayNow.onSay(entryRef(entry))}
            size="sm"
            tone="primary"
          >
            <Mic aria-hidden="true" />
            Say it now
          </Button>
        )}
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
