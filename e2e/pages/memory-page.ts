import type { Locator, Page } from '@playwright/test';
import { ReviewPage } from './review-page';

export class MemoryPage {
  readonly review: ReviewPage;
  readonly mistakePracticeHeading: Locator;
  readonly startPracticeButton: Locator;
  readonly mistakesTab: Locator;

  constructor(private readonly page: Page) {
    this.review = new ReviewPage(page);
    this.mistakePracticeHeading = page.getByRole('heading', { name: 'Practice my usual mistakes' });
    this.startPracticeButton = page.getByRole('button', { name: 'Start practice', exact: true });
    this.mistakesTab = page.getByRole('tab', { name: 'Mistakes · 1' });
  }

  correctedExample(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  async startPractice(): Promise<void> {
    await this.startPracticeButton.click();
  }

  async openMistakes(): Promise<void> {
    await this.mistakesTab.click();
  }
}
