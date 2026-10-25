import type { Locator, Page } from '@playwright/test';

export class PlannerPanel {
  readonly frameButton: Locator;
  readonly phrasesButton: Locator;
  readonly exampleButton: Locator;
  readonly hideButton: Locator;
  readonly retryButton: Locator;
  readonly cancelPlanningButton: Locator;
  readonly cueFailure: Locator;

  constructor(private readonly page: Page) {
    this.frameButton = page.getByRole('button', { name: 'Frame', exact: true });
    this.phrasesButton = page.getByRole('button', { name: 'Phrases', exact: true });
    this.exampleButton = page.getByRole('button', { name: 'Example', exact: true });
    this.hideButton = page.getByRole('button', { name: 'Hide before speaking', exact: true });
    this.retryButton = page.getByRole('button', { name: 'Retry help', exact: true });
    this.cancelPlanningButton = page.getByRole('button', { name: 'Cancel planning', exact: true });
    this.cueFailure = page.getByText(/Help could not be marked/);
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  content(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  async planFor(seconds: 15 | 30): Promise<void> {
    await this.page.getByRole('button', { name: `${seconds} seconds`, exact: true }).click();
  }

  planningTime(seconds: number): Locator {
    return this.page.getByText(`Planning time: ${seconds}s`, { exact: true });
  }
}
