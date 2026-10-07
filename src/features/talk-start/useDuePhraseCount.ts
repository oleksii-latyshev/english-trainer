import { useEffect, useState } from 'react';
import { getLearningMemory } from '@/features/memory/memoryApi';

type DueCount = { tag: 'loading' } | { tag: 'ready'; dueCount: number } | { tag: 'unavailable' };

/** Phrases due for review; reloads when Memory changes. Failures leave the secondary card hidden. */
export function useDuePhraseCount(): DueCount {
  const [state, setState] = useState<DueCount>({ tag: 'loading' });

  useEffect(() => {
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const memory = await getLearningMemory();
        if (request === generation) setState({ tag: 'ready', dueCount: memory.due_count });
      } catch {
        if (request === generation) setState({ tag: 'unavailable' });
      }
    };
    const reload = () => void load();
    reload();
    window.addEventListener('learning-memory-changed', reload);
    return () => {
      generation += 1;
      window.removeEventListener('learning-memory-changed', reload);
    };
  }, []);

  return state;
}
