import type { Page } from '@playwright/test';

type SpokenDay = { date: string; minutes: number };

export class SpeakingActivityBackend {
  private days: SpokenDay[] = [];

  constructor(private readonly page: Page) {}

  with(days: SpokenDay[]): this {
    this.days = days;
    return this;
  }

  async install(): Promise<void> {
    await this.page.addInitScript((days: SpokenDay[]) => {
      const internals = window.__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      internals.invoke = async (command, args = {}) => {
        if (command !== 'get_speaking_activity') return invoke(command, args);
        window.__ET_HARNESS__.calls.push({ command, args });
        return { days };
      };
    }, this.days);
  }
}
