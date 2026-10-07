import { Button, SearchField, toast } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { DeleteMemoryDialog } from '@/features/memory/components/DeleteMemoryDialog';
import type { MemoryEntry } from '@/features/memory/components/MemoryRow';
import { MemoryTabs } from '@/features/memory/components/MemoryTabs';
import { ReviewBanner } from '@/features/memory/components/ReviewBanner';
import { searchMemory, visibleMemory } from '@/features/memory/lib/memoryState';
import { useActiveReview } from '@/features/memory/useActiveReview';
import { useMemoryLibrary } from '@/features/memory/useMemoryLibrary';
import { archiveLearningItem, deleteMistake, deletePhraseCard } from './memoryApi';
import './memory.css';
import './memoryControls.css';

type Props = {
  /** The microphone is in use elsewhere, so a spoken review cannot start. */
  isAudioBusy: boolean;
  onStartReview: () => void;
};

function toEntries(memory: ReturnType<typeof visibleMemory>) {
  return {
    phrases: memory.phrases.map((card): MemoryEntry => ({ kind: 'phrase', card })),
    mistakes: memory.mistakes.map((mistake): MemoryEntry => ({ kind: 'mistake', mistake })),
  };
}

function removeEntry(entry: MemoryEntry): Promise<boolean> {
  return entry.kind === 'phrase'
    ? deletePhraseCard(entry.card.id)
    : deleteMistake(entry.mistake.id);
}

export function LearningMemoryPanel({ isAudioBusy, onStartReview }: Props) {
  const { library, retry } = useMemoryLibrary();
  const active = useActiveReview();
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<MemoryEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleArchive(entry: MemoryEntry) {
    const itemType = entry.kind;
    const itemId = entry.kind === 'phrase' ? entry.card.id : entry.mistake.id;
    try {
      await archiveLearningItem(itemType, itemId);
      toast('Archived. Saving it again brings it back.');
    } catch {
      toast.danger('Could not archive that. Please try again.');
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await removeEntry(pendingDelete);
      toast('Removed from Memory');
      setPendingDelete(null);
    } catch {
      toast.danger('Could not remove that. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  const view = library.tag === 'ready' ? library.view : null;
  const visible = view ? visibleMemory(view) : { phrases: [], mistakes: [] };
  const { phrases, mistakes } = toEntries(searchMemory(visible, query));

  return (
    <div className="memory">
      <header className="memory-header">
        <h1>Memory</h1>
        <SearchField
          aria-label="Search memory"
          className="memory-search"
          onChange={setQuery}
          value={query}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search phrases and mistakes" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </header>

      <ReviewBanner
        active={active}
        dueCount={view?.due_count ?? 0}
        isBusy={isAudioBusy || library.tag === 'loading'}
        onStart={onStartReview}
      />

      {library.tag === 'error' && (
        <div className="memory-notice" role="alert">
          <TriangleAlert aria-hidden="true" size={18} />
          <span>Could not load Memory from local storage.</span>
          <Button onPress={retry} size="sm" variant="secondary">
            Try again
          </Button>
        </div>
      )}

      {library.tag === 'loading' && <p className="memory-footnote">Loading Memory…</p>}

      {view && (
        <MemoryTabs
          mistakes={mistakes}
          onArchive={(entry) => void handleArchive(entry)}
          onDelete={setPendingDelete}
          phrases={phrases}
          query={query}
        />
      )}

      <p className="memory-footnote">
        Phrases land here when you tap <strong>Save phrase</strong> under an answer or{' '}
        <strong>Save all</strong> after a session. Mistakes are added for you when Eva’s notes point
        one out.
      </p>

      <DeleteMemoryDialog
        entry={pendingDelete}
        isBusy={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
