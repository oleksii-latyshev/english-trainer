import type { Page } from '@playwright/test';
import type { LearningMemoryView, MemoryUsageEvidence } from '@/core/ipc';
import { mistakeMemory, repeatedMistake } from '../../data/mistakes';

type LibraryState = {
  view: LearningMemoryView;
  evidence: MemoryUsageEvidence[];
  failFirstRead: boolean;
};

export class MemoryBackend {
  view: LearningMemoryView = { mistakes: [], phrase_cards: [], due_count: 0 };
  failsNextMistakePractice = false;
  mistakePreparationDelayMs = 0;
  private library: LibraryState | null = null;

  constructor(private readonly page: Page) {}

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

  withLibrary(view: LearningMemoryView, evidence: MemoryUsageEvidence[] = []): this {
    this.library = { view, evidence, failFirstRead: false };
    return this;
  }

  failingFirstRead(): this {
    if (this.library) this.library.failFirstRead = true;
    return this;
  }

  preparingMistakePracticeFor(ms: number): this {
    this.mistakePreparationDelayMs = ms;
    return this;
  }

  failingNextMistakePractice(): this {
    this.failsNextMistakePractice = true;
    return this;
  }

  async install(): Promise<void> {
    if (!this.library) return;
    await this.page.addInitScript((seed: LibraryState) => {
      const internals = window.__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      const state = structuredClone(seed);
      let remainingFailures = state.failFirstRead ? 1 : 0;
      function setStatus(kind: 'phrase_cards' | 'mistakes', id: unknown, status: string) {
        for (const item of state.view[kind]) {
          if (item.id === id) Object.assign(item, { status });
        }
      }
      internals.invoke = async (command, args = {}) => {
        const harness = window.__ET_HARNESS__;
        switch (command) {
          case 'get_learning_memory':
          case 'view_learning_memory':
            harness.calls.push({ command, args });
            if (command === 'view_learning_memory' && remainingFailures > 0) {
              remainingFailures -= 1;
              throw { code: 'database_error', message: 'Could not read Memory.' };
            }
            return state.view;
          case 'archive_learning_item':
            harness.calls.push({ command, args });
            setStatus(
              args.item_type === 'phrase' ? 'phrase_cards' : 'mistakes',
              args.item_id,
              'archived',
            );
            return true;
          case 'delete_phrase_card':
            harness.calls.push({ command, args });
            state.view.phrase_cards = state.view.phrase_cards.filter(
              (card) => card.id !== args.phrase_id,
            );
            return true;
          case 'delete_mistake':
            harness.calls.push({ command, args });
            state.view.mistakes = state.view.mistakes.filter((item) => item.id !== args.mistake_id);
            return true;
          case 'get_memory_usage_evidence': {
            harness.calls.push({ command, args });
            const found = state.evidence.find(
              (item) => item.item_type === args.item_type && item.item_id === args.item_id,
            );
            return (
              found ?? {
                item_type: args.item_type,
                item_id: args.item_id,
                distinct_session_count: 0,
                streak: 0,
                events: [],
              }
            );
          }
          default:
            return invoke(command, args);
        }
      };
    }, this.library);
  }
}
