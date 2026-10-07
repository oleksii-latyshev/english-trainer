import { Tabs } from '@heroui/react';
import { Bookmark } from 'lucide-react';
import { useState } from 'react';
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

function isMemoryTab(key: unknown): key is MemoryTab {
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
      <Tabs.Panel id={id}>
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
      </Tabs.Panel>
    );
  }

  return (
    <Tabs
      onSelectionChange={(key) => {
        if (isMemoryTab(key)) setTab(key);
      }}
      selectedKey={tab}
    >
      <div className="memory-tabs-bar">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Memory lists">
            <Tabs.Tab id="phrases">
              Phrases · {phrases.length}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="mistakes">
              Mistakes · {mistakes.length}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <span className="memory-tabs-bar-note">Archived items are hidden</span>
      </div>
      {renderPanel('phrases')}
      {renderPanel('mistakes')}
    </Tabs>
  );
}
