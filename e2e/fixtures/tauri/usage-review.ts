import type { Page } from '@playwright/test';

export const USAGE_TARGET = 'It saves me time.';

async function installUsageReview(page: Page): Promise<void> {
  await page.addInitScript((target: string) => {
    const harness = window.__ET_HARNESS__;
    const internals = window.__TAURI_INTERNALS__;
    const original = internals.invoke;
    internals.invoke = async (command, args = {}) => {
      if (command === 'get_practice_memory_usage') {
        harness.calls.push({ command, args });
        return null;
      }
      if (command === 'review_practice_memory_usage') {
        harness.calls.push({ command, args });
        return {
          session_id: args.session_id,
          sequence: args.sequence,
          assessed_at: 1,
          findings: [
            {
              item_type: 'phrase',
              item_id: 7,
              target,
              outcome: 'correct',
              confidence: 0.95,
              exact_excerpt: 'it saves me time',
              credited: true,
              status_after: 'improving',
            },
          ],
        };
      }
      return original(command, args);
    };
  }, USAGE_TARGET);
}

export class UsageReviewBackend {
  enabled = false;

  constructor(private readonly page: Page) {}

  available(): this {
    this.enabled = true;
    return this;
  }

  async install(): Promise<void> {
    if (this.enabled) await installUsageReview(this.page);
  }
}
