import type { Locator, Page } from '@playwright/test';

export class ConversationsPage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly showMore: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Conversations', exact: true });
    this.rows = page.getByRole('list', { name: 'All conversations' }).getByRole('listitem');
    this.showMore = page.getByRole('button', { name: 'Show more' });
  }

  async open(title: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  }
}
