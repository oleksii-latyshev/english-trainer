import type { Locator, Page } from '@playwright/test';

export class UsageReview {
  readonly card: Locator;
  readonly checkButton: Locator;
  readonly checking: Locator;

  constructor(page: Page) {
    this.card = page.getByRole('region', { name: 'Learning use review' });
    this.checkButton = this.card.getByRole('button', { name: 'Check learning use' });
    this.checking = this.card.getByText('Checking saved answer with AI…');
  }

  async check(): Promise<void> {
    await this.checkButton.click();
  }
}
