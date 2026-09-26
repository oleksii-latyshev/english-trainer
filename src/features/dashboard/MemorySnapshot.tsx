import { Button, Chip, Separator, Skeleton, Surface } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLearningMemory } from '@/features/memory/memoryApi';

type Snapshot =
  | { tag: 'loading' }
  | { tag: 'ready'; dueCount: number; totalCount: number }
  | { tag: 'error' };

export function MemorySnapshot({ onOpenMemory }: { onOpenMemory: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ tag: 'loading' });
  const generation = useRef(0);

  const loadMemory = useCallback(async () => {
    const request = ++generation.current;
    setSnapshot({ tag: 'loading' });
    try {
      const memory = await getLearningMemory();
      if (request !== generation.current) return;
      setSnapshot({
        tag: 'ready',
        dueCount: memory.due_count,
        totalCount: memory.mistakes.length + memory.phrase_cards.length,
      });
    } catch {
      if (request === generation.current) setSnapshot({ tag: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadMemory();
    const reload = () => void loadMemory();
    window.addEventListener('learning-memory-changed', reload);
    return () => {
      generation.current += 1;
      window.removeEventListener('learning-memory-changed', reload);
    };
  }, [loadMemory]);

  return (
    <Surface className="dashboard-memory" variant="secondary">
      <div className="dashboard-memory-header">
        <div>
          <p className="section-kicker">LEARNING MEMORY</p>
          <h2 className="section-title">Keep useful phrases close</h2>
        </div>
        {snapshot.tag === 'ready' && (
          <Chip color={snapshot.dueCount > 0 ? 'warning' : 'success'} size="sm" variant="soft">
            {snapshot.dueCount} due
          </Chip>
        )}
      </div>
      <Separator variant="tertiary" />
      {snapshot.tag === 'loading' && (
        <div className="dashboard-memory-loading" role="status">
          <span className="sr-only">Loading Learning Memory</span>
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      )}
      {snapshot.tag === 'ready' && (
        <p className="dashboard-memory-copy">
          {snapshot.totalCount === 0
            ? 'Your saved corrections and phrases will appear here after practice.'
            : `${snapshot.totalCount} saved item${snapshot.totalCount === 1 ? '' : 's'} · ${snapshot.dueCount} ready for review.`}
        </p>
      )}
      {snapshot.tag === 'error' && (
        <div className="dashboard-memory-error" role="alert">
          <span>Could not load Learning Memory.</span>
          <Button onPress={() => void loadMemory()} size="sm" variant="tertiary">
            Retry
          </Button>
        </div>
      )}
      <Button onPress={onOpenMemory} size="sm" variant="secondary">
        Open Learning Memory
      </Button>
    </Surface>
  );
}
