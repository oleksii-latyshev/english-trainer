import type { Locator, Page } from '@playwright/test';

export class Chat {
  readonly history: Locator;
  readonly newMessageButton: Locator;

  constructor(page: Page) {
    this.history = page.getByRole('log', { name: 'Conversation message history' });
    this.newMessageButton = page.getByRole('button', { name: 'New message', exact: true });
  }

  distanceFromEnd(): Promise<number> {
    return this.history.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight);
  }

  height(): Promise<number> {
    return this.history.evaluate((node) => node.clientHeight);
  }

  async scrollToTop(): Promise<void> {
    await this.history.evaluate((node) => {
      node.scrollTop = 0;
    });
  }
}
