import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Bookmark, TriangleAlert } from 'lucide-react';
import { openedLearningMemoryAtom } from '@/core/learning-memory';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Notice } from '@/shared/ui/notice';
import { Switch } from '@/shared/ui/switch';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/shared/ui/tabs';
import { COLUMN_TITLE, emptyCopy, isMemoryTab } from '../../helpers/list-copy';
import { entriesOfTab, entryKey } from '../../helpers/memory-entries';
import {
  activeTabAtom,
  libraryAtom,
  openEntryKeyAtom,
  searchQueryAtom,
  showArchivedAtom,
  shownCountsAtom,
  shownEntriesAtom,
} from '../../model/atoms';
import type { MemoryTab } from '../../types';
import { MemoryRow } from '../memory-row';

const TABS: readonly { readonly id: MemoryTab; readonly label: string }[] = [
  { id: 'phrases', label: 'Phrases' },
  { id: 'mistakes', label: 'Mistakes' },
];

function EmptyList({ tab }: { tab: MemoryTab }) {
  const query = useAtomValue(searchQueryAtom);
  const copy = emptyCopy(tab, query);
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-10 text-center text-caption text-faint">
      <Bookmark aria-hidden="true" size={24} />
      <div className="font-semibold text-body text-foreground">{copy.title}</div>
      <div>{copy.hint}</div>
    </div>
  );
}

function TabList({ tab }: { tab: MemoryTab }) {
  const shown = useAtomValue(shownEntriesAtom);
  const [openKey, setOpenKey] = useAtom(openEntryKeyAtom);
  const entries = entriesOfTab(shown, tab);
  const now = Date.now();

  if (entries.length === 0) return <EmptyList tab={tab} />;
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      <li
        aria-hidden="true"
        className="grid grid-cols-[minmax(0,1fr)_8rem_7.5rem_7.5rem_2rem] items-center gap-3 border-line-soft border-b px-5 py-3 text-faint text-xs"
      >
        <span>{COLUMN_TITLE[tab]}</span>
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
          />
        );
      })}
    </ul>
  );
}

export function LibraryList() {
  const library = useAtomValue(libraryAtom);
  const retry = useAtomRefresh(openedLearningMemoryAtom);
  const [tab, setTab] = useAtom(activeTabAtom);
  const [showArchived, setShowArchived] = useAtom(showArchivedAtom);
  const counts = useAtomValue(shownCountsAtom);

  if (library.tag === 'loading') {
    return (
      <Notice role="status" tone="quiet">
        Loading Memory…
      </Notice>
    );
  }
  if (library.tag === 'unavailable') {
    return (
      <Notice className="flex items-center gap-3 rounded-control border" role="alert" tone="quiet">
        <TriangleAlert aria-hidden="true" size={18} />
        <span className="flex-1">Could not load Memory from local storage.</span>
        <Button onClick={retry} size="sm" tone="secondary">
          Try again
        </Button>
      </Notice>
    );
  }

  return (
    <Tabs
      className="min-h-0 flex-1"
      onValueChange={(next) => {
        if (isMemoryTab(next)) setTab(next);
      }}
      value={tab}
    >
      <div className="flex items-center gap-3">
        <TabsList label="Memory lists">
          {TABS.map(({ id, label }) => (
            <TabsTab key={id} value={id}>
              {label} <span className="ml-1 font-medium text-faint">{counts[id]}</span>
            </TabsTab>
          ))}
        </TabsList>
        <span className="text-caption text-faint">Sorted by next review</span>
        <Switch
          checked={showArchived}
          className="ml-auto"
          label="Show archived"
          onCheckedChange={setShowArchived}
        />
      </div>
      {TABS.map(({ id }) => (
        <TabsPanel className="mt-0 min-h-0 flex-1 p-0" key={id} value={id}>
          <GlassPanel
            aria-label={`${id === 'phrases' ? 'Phrases' : 'Mistakes'} in Memory`}
            className="overflow-hidden"
          >
            <TabList tab={id} />
          </GlassPanel>
        </TabsPanel>
      ))}
    </Tabs>
  );
}
