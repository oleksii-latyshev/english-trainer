import type { Locator, Page } from '@playwright/test';
import { ReviewPage } from './review-page';

export class MemoryPage {
  readonly review: ReviewPage;
  readonly mistakePracticeHeading: Locator;
  readonly startPracticeButton: Locator;
  readonly search: Locator;
  readonly showArchived: Locator;
  readonly loadFailure: Locator;
  readonly retryButton: Locator;
  readonly deleteDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;
  readonly statusSummary: Locator;
  readonly heading: Locator;
  readonly sayItNowButton: Locator;

  constructor(private readonly page: Page) {
    this.review = new ReviewPage(page);
    this.mistakePracticeHeading = page.getByRole('heading', { name: 'Practice my usual mistakes' });
    this.startPracticeButton = page.getByRole('button', { name: 'Practice · 2 min' });
    this.search = page.getByRole('searchbox', { name: 'Search memory' });
    this.showArchived = page.getByRole('switch', { name: 'Show archived' });
    this.loadFailure = page.getByText('Could not load Memory from local storage.');
    this.retryButton = page.getByRole('button', { name: 'Try again' });
    this.deleteDialog = page.getByRole('alertdialog', { name: 'Delete from Memory?' });
    this.confirmDeleteButton = this.deleteDialog.getByRole('button', { name: 'Delete' });
    this.cancelDeleteButton = this.deleteDialog.getByRole('button', { name: 'Cancel' });
    this.statusSummary = page.getByRole('region', { name: 'Where they are' });
    this.heading = page.getByRole('heading', { name: 'Memory', exact: true });
    this.sayItNowButton = page.getByRole('button', { name: 'Say it now' });
  }

  row(text: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${text}`) });
  }

  evidenceFor(text: string): Locator {
    return this.page.getByRole('region', { name: 'Evidence from conversations' }).getByText(text);
  }

  kind(text: string): Locator {
    return this.page.getByRole('definition').filter({ hasText: new RegExp(`^${text}$`) });
  }

  archiveButton(label: string): Locator {
    return this.page.getByRole('button', { name: `Archive ${label}` });
  }

  deleteButton(label: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${label}` });
  }

  async startPractice(): Promise<void> {
    await this.startPracticeButton.click();
  }

  async open(text: string): Promise<void> {
    await this.row(text).click();
  }
}
