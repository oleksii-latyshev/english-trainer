import { useEffect, useState } from 'react';
import { getResolvedItemCount } from './lib/memoryRecallState';
import type { ActiveReview } from './lib/reviewBanner';
import { getMemoryReview } from './memoryRecallApi';

/**
 * Whether a spoken review was started and not finished. Only the banner's wording depends on it:
 * the review screen itself resumes a saved run, so a failed check reads as "none".
 */
export function useActiveReview(): ActiveReview {
  const [active, setActive] = useState<ActiveReview>({ tag: 'none' });

  useEffect(() => {
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const run = await getMemoryReview();
        if (request !== generation) return;
        setActive(
          run
            ? { tag: 'saved', resolved: getResolvedItemCount(run.items), total: run.items.length }
            : { tag: 'none' },
        );
      } catch {
        // The check only words the banner; starting the review still resumes a saved run.
        if (request === generation) setActive({ tag: 'none' });
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

  return active;
}
