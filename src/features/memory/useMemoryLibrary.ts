import { useEffect, useState } from 'react';
import type { LearningMemoryView } from '@/lib/learningTypes';
import { getLearningMemory } from './memoryApi';

export type MemoryLibrary =
  | { tag: 'loading' }
  | { tag: 'error' }
  | { tag: 'ready'; view: LearningMemoryView };

/**
 * Everything saved in Memory, kept fresh: it reloads on `learning-memory-changed`, so a save,
 * archive or review anywhere shows up here. A failed reload keeps what is already on screen.
 */
export function useMemoryLibrary(): { library: MemoryLibrary; retry: () => void } {
  const [library, setLibrary] = useState<MemoryLibrary>({ tag: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // `attempt` is the retry: changing it runs the load again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry trigger, not a value the effect reads.
  useEffect(() => {
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        // Opening Memory counts as showing the saved cues, which the usage review needs to know.
        const view = await getLearningMemory(true);
        if (request === generation) setLibrary({ tag: 'ready', view });
      } catch {
        if (request === generation) {
          setLibrary((current) => (current.tag === 'ready' ? current : { tag: 'error' }));
        }
      }
    };
    const reload = () => void load();
    reload();
    window.addEventListener('learning-memory-changed', reload);
    return () => {
      generation += 1;
      window.removeEventListener('learning-memory-changed', reload);
    };
  }, [attempt]);

  return {
    library,
    retry: () => {
      setLibrary({ tag: 'loading' });
      setAttempt((count) => count + 1);
    },
  };
}
