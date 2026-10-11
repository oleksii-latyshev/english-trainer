import { Bookmark } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/shared/ui/tabs';
import { type MemoryEntry, MemoryRow } from './MemoryRow';

export type MemoryTab = 'phrases' | 'mistakes';

type Props = {
  phrases: MemoryEntry[];
  mistakes: MemoryEntry[];
  /** The search text; a tab with no entries explains itself differently while it is set. */
  query: string;
  onArchive: (entry: MemoryEntry) => void;
  onDelete: (entry: MemoryEntry) => void;
};

function isMemoryTab(key: string): key is MemoryTab {
  return key === 'phrases' || key === 'mistakes';
}

const COLUMN_TITLE: Record<MemoryTab, string> = {
  phrases: 'Phrase and where it came from',
  mistakes: 'Original → better',
};

const EMPTY_COPY: Record<MemoryTab, { title: string; hint: string }> = {
  phrases: {
    title: 'No phrases saved yet',
    hint: 'Save one under an answer in a conversation, and it will wait here for review.',
  },
  mistakes: {
    title: 'No mistakes yet',
    hint: 'When Eva’s notes point one out, it is added here for you.',
  },
};

function EmptyTab({ tab, query }: { tab: MemoryTab; query: string }) {
  const trimmed = query.trim();
  const copy = trimmed
    ? { title: `Nothing matches “${trimmed}”`, hint: 'Try another word, or look in the other tab.' }
    : EMPTY_COPY[tab];
  return (
    <div className="memory-list">
      <div className="memory-empty">
        <Bookmark aria-hidden="true" size={24} />
        <div className="memory-empty-title">{copy.title}</div>
        <div>{copy.hint}</div>
      </div>
    </div>
  );
}

export function MemoryTabs({ phrases, mistakes, query, onArchive, onDelete }: Props) {
  const [tab, setTab] = useState<MemoryTab>('phrases');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const lists: Record<MemoryTab, MemoryEntry[]> = { phrases, mistakes };

  function renderPanel(id: MemoryTab) {
    const entries = lists[id];
    return (
      <TabsPanel value={id}>
        {entries.length === 0 ? (
          <EmptyTab query={query} tab={id} />
        ) : (
          <ul className="memory-list">
            <li aria-hidden="true" className="memory-list-head">
              <span>{COLUMN_TITLE[id]}</span>
              <span>Status</span>
              <span />
            </li>
            {entries.map((entry) => {
              const key =
                entry.kind === 'phrase' ? `phrase-${entry.card.id}` : `mistake-${entry.mistake.id}`;
              return (
                <MemoryRow
                  entry={entry}
                  isOpen={openKey === key}
                  key={key}
                  onArchive={() => onArchive(entry)}
                  onDelete={() => onDelete(entry)}
                  onToggle={() => setOpenKey(openKey === key ? null : key)}
                />
              );
            })}
          </ul>
        )}
      </TabsPanel>
    );
  }

  return (
    <Tabs
      onValueChange={(key) => {
        if (isMemoryTab(key)) setTab(key);
      }}
      value={tab}
    >
      <div className="memory-tabs-bar">
        <TabsList label="Memory lists">
          <TabsTab value="phrases">Phrases · {phrases.length}</TabsTab>
          <TabsTab value="mistakes">Mistakes · {mistakes.length}</TabsTab>
        </TabsList>
        <span className="memory-tabs-bar-note">Archived items are hidden</span>
      </div>
      {renderPanel('phrases')}
      {renderPanel('mistakes')}
    </Tabs>
  );
}
