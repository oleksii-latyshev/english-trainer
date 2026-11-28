import type { Page } from '@playwright/test';
import type { FinishedPracticeSession } from '@/core/ipc';
import type { FinishedSessionItem } from '@/core/ipc/bindings/FinishedSessionItem';
import type { PracticeDialogue } from '@/core/ipc/bindings/PracticeDialogue';

type HistorySeed = {
  items: FinishedSessionItem[];
  finished: FinishedPracticeSession;
  dialogue: PracticeDialogue;
};

export class HistoryBackend {
  private seed: HistorySeed | null = null;

  constructor(private readonly page: Page) {}

  with(
    items: FinishedSessionItem[],
    finished: FinishedPracticeSession,
    dialogue: PracticeDialogue,
  ): this {
    this.seed = { items, finished, dialogue };
    return this;
  }

  async install(): Promise<void> {
    if (!this.seed) return;
    await this.page.addInitScript((seed: HistorySeed) => {
      const harness = window.__ET_HARNESS__;
      harness.finished = seed.finished;
      harness.dialogue = seed.dialogue;
      const internals = window.__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      internals.invoke = async (command, args = {}) => {
        if (command !== 'list_finished_sessions') return invoke(command, args);
        harness.calls.push({ command, args });
        const limit = Number(args.limit);
        const offset = Number(args.offset);
        return {
          sessions: seed.items.slice(offset, offset + limit),
          has_more: offset + limit < seed.items.length,
        };
      };
    }, this.seed);
  }
}
