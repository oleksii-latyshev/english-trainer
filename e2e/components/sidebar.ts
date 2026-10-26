import type { Page } from '@playwright/test';

export class Sidebar {
  constructor(private readonly page: Page) {}

  async openSpeak(): Promise<void> {
    await this.page.getByRole('button', { name: /^Speak/ }).click();
  }

  async openTalk(): Promise<void> {
    await this.page.getByRole('button', { name: 'Talk', exact: true }).click();
  }

  async openMemory(): Promise<void> {
    await this.page.getByRole('button', { name: /^Memory/ }).click();
  }

  async openSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
}
