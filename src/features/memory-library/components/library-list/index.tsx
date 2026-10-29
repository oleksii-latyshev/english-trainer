import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Bookmark, TriangleAlert } from 'lucide-react';
import { openedLearningMemoryAtom } from '@/core/learning-memory';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Notice } from '@/shared/ui/notice';
import { Switch } from '@/shared/ui/switch';
import { COLUMN_TITLE, emptyCopy } from '../../helpers/list-copy';
import { entryKey } from '../../helpers/memory-entries';
import {
  libraryAtom,
  openEntryKeyAtom,
  searchQueryAtom,
  showArchivedAtom,
  shownEntriesAtom,
} from '../../model/atoms';
import type { SayNow } from '../../types';
import { MemoryRow } from '../memory-row';

function EmptyList() {
  const query = useAtomValue(searchQueryAtom);
  const copy = emptyCopy(query);
  return (
    <div className="text-caption text-faint flex flex-col items-center gap-1 px-5 py-10 text-center">
      <Bookmark aria-hidden="true" size={24} />
      <div className="text-body text-foreground font-semibold">{copy.title}</div>
      <div>{copy.hint}</div>
    </div>
  );
}

function PhraseList({ sayNow }: { sayNow: SayNow }) {
  const entries = useAtomValue(shownEntriesAtom);
  const [openKey, setOpenKey] = useAtom(openEntryKeyAtom);
  const now = Date.now();

  if (entries.length === 0) return <EmptyList />;
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      <li
        aria-hidden="true"
        className="border-line-soft text-faint grid grid-cols-[minmax(0,1fr)_8rem_7.5rem_7.5rem_2rem] items-center gap-3 border-b px-5 py-3 text-xs"
      >
        <span>{COLUMN_TITLE}</span>
        <span>Status</span>
        <span>Next review</span>
        <span>On your own</span>
        <span />
      </li>
      {entries.map((entry) => {
        const key = entryKey(entry);
        return (
          <MemoryRow
            entry={entry}
            isOpen={openKey === key}
            key={key}
            now={now}
            onToggle={() => setOpenKey(openKey === key ? null : key)}
            sayNow={sayNow}
          />
        );
      })}
    </ul>
  );
}

export function LibraryList({ sayNow }: { sayNow: SayNow }) {
  const library = useAtomValue(libraryAtom);
  const retry = useAtomRefresh(openedLearningMemoryAtom);
  const [showArchived, setShowArchived] = useAtom(showArchivedAtom);

  if (library.tag === 'loading') {
    return (
      <Notice role="status" tone="quiet">
        Loading Memory…
      </Notice>
    );
  }
  if (library.tag === 'unavailable') {
    return (
      <Notice className="rounded-control flex items-center gap-3 border" role="alert" tone="quiet">
        <TriangleAlert aria-hidden="true" size={18} />
        <span className="flex-1">Could not load Memory from local storage.</span>
        <Button onClick={retry} size="sm" tone="secondary">
          Try again
        </Button>
      </Notice>
    );
  }

  return (
    <section aria-label="Phrases in Memory" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-body m-0 font-bold">Phrases</h2>
        <span className="text-caption text-faint">Sorted by next review</span>
        <Switch
          checked={showArchived}
          className="ml-auto"
          label="Show archived"
          onCheckedChange={setShowArchived}
        />
      </div>
      <GlassPanel aria-label="Phrases list" className="overflow-hidden">
        <PhraseList sayNow={sayNow} />
      </GlassPanel>
    </section>
  );
}
