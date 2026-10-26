import type { Locator, Page } from '@playwright/test';

export class Sidebar {
  readonly growthCard: Locator;

  constructor(private readonly page: Page) {
    this.growthCard = page.getByRole('button', { name: /^Eva's growth/ });
  }

  async openSpeak(): Promise<void> {
    await this.page.getByRole('button', { name: /^Speak/ }).click();
  }

  async openTalk(): Promise<void> {
    await this.page.getByRole('button', { name: 'Talk', exact: true }).click();
  }

  async openMemory(): Promise<void> {
    await this.page.getByRole('button', { name: /^Memory/ }).click();
  }

  async openGrowth(): Promise<void> {
    await this.growthCard.click();
  }

  async openSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
}
