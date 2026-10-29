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

  async gapBelow(text: string): Promise<number> {
    const message = await this.history.getByText(text, { exact: true }).boundingBox();
    const history = await this.history.boundingBox();
    if (message === null || history === null) throw new Error(`"${text}" is not on screen.`);
    return history.y + history.height - (message.y + message.height);
  }

  async isFullyInView(target: Locator): Promise<boolean> {
    const box = await target.boundingBox();
    const history = await this.history.boundingBox();
    if (box === null || history === null) return false;
    return box.y >= history.y && box.y + box.height <= history.y + history.height;
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
