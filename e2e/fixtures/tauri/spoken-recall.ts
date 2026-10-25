import type { Page } from '@playwright/test';

export type RecallSeed = {
  items: { phrase_id: number; cue: string }[];
  target: string;
};

export async function installSpokenRecall(page: Page, seed: RecallSeed): Promise<void> {
  await page.addInitScript((config: RecallSeed) => {
    const harness = window.__ET_HARNESS__;
    const internals = window.__TAURI_INTERNALS__;
    const original = internals.invoke;
    let pending = [...config.items];
    let completed = 0;
    internals.invoke = async (command, args = {}) => {
      if (command === 'get_daily_recall_plan') {
        harness.calls.push({ command, args });
        return { items: pending, completed_count: completed };
      }
      if (command === 'submit_daily_recall') {
        harness.calls.push({ command, args });
        pending = pending.filter((item) => item.phrase_id !== args.phraseId);
        completed += 1;
        return {
          phrase_id: args.phraseId,
          transcript: args.transcript,
          target: config.target,
          wording_observed: false,
        };
      }
      return original(command, args);
    };
  }, seed);
}

export class SpokenRecallBackend {
  private seed: RecallSeed | null = null;

  constructor(private readonly page: Page) {}

  withDuePhrases(items: RecallSeed['items'], target: string): this {
    this.seed = { items, target };
    return this;
  }

  async install(): Promise<void> {
    if (this.seed) await installSpokenRecall(this.page, this.seed);
  }
}
