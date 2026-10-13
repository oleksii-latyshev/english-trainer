import { useEffect, useState } from 'react';
import type { MistakeRecord, PhraseCardRecord } from '@/lib/learningTypes';
import { isEligibleMistakePracticeTarget } from './lib/mistakePractice';
import { getLearningMemory } from './memoryApi';

const SHOWN_MISTAKES = 3;

export type DueCount =
  | { tag: 'loading' }
  | {
      tag: 'ready';
      dueCount: number;
      duePhraseCount?: number;
      nextDuePhrase?: PhraseCardRecord;
      usualMistakes?: MistakeRecord[];
    }
  | { tag: 'unavailable' };

/** Phrases due for review; reloads when Memory changes. Failures hide the count and the review card. */
export function useDuePhraseCount(): DueCount {
  const [state, setState] = useState<DueCount>({ tag: 'loading' });

  useEffect(() => {
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const memory = await getLearningMemory();
        if (request === generation) {
          const duePhrases = memory.phrase_cards.filter((card) => card.is_due);
          setState({
            tag: 'ready',
            dueCount: memory.due_count,
            duePhraseCount: duePhrases.length,
            nextDuePhrase: duePhrases[0],
            usualMistakes: memory.mistakes
              .filter(isEligibleMistakePracticeTarget)
              .sort((a, b) => b.times_seen - a.times_seen)
              .slice(0, SHOWN_MISTAKES),
          });
        }
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
