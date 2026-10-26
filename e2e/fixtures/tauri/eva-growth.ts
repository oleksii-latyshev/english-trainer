import type { Page } from '@playwright/test';
import { type GrowthSeed, quietSeed } from '../../data/growth';

export class EvaGrowthBackend {
  private seed: GrowthSeed = quietSeed;

  constructor(private readonly page: Page) {}

  with(seed: GrowthSeed): this {
    this.seed = seed;
    return this;
  }

  async install(): Promise<void> {
    await this.page.addInitScript((growth: GrowthSeed) => {
      const internals = window.__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      internals.invoke = async (command, args = {}) => {
        if (command !== 'get_eva_growth') return invoke(command, args);
        window.__ET_HARNESS__.calls.push({ command, args });
        return growth;
      };
    }, this.seed);
  }
}
