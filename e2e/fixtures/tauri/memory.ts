import type { LearningMemoryView } from '@/lib/learningTypes';
import { mistakeMemory, repeatedMistake } from '../../data/mistakes';

export class MemoryBackend {
  view: LearningMemoryView = { mistakes: [], phrase_cards: [], due_count: 0 };
  failsNextMistakePractice = false;
  mistakePreparationDelayMs = 0;

  with(view: LearningMemoryView): this {
    this.view = view;
    return this;
  }

  withRepeatedMistake(): this {
    return this.with(mistakeMemory);
  }

  withoutPracticableMistakes(): this {
    return this.with({
      ...mistakeMemory,
      mistakes: [
        { ...repeatedMistake, times_seen: 1 },
        { ...repeatedMistake, id: 18, status: 'archived' },
      ],
    });
  }

  preparingMistakePracticeFor(ms: number): this {
    this.mistakePreparationDelayMs = ms;
    return this;
  }

  failingNextMistakePractice(): this {
    this.failsNextMistakePractice = true;
    return this;
  }
}
