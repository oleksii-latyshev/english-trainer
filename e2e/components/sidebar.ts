import type { Locator, Page } from '@playwright/test';

export class Sidebar {
  readonly growthCard: Locator;
  readonly mistakesBadge: Locator;

  constructor(private readonly page: Page) {
    this.mistakesBadge = page.getByRole('button', { name: 'Mistakes, 3 due' });
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

  async openMistakes(): Promise<void> {
    await this.page.getByRole('button', { name: /^Mistakes/ }).click();
  }

  async openGrowth(): Promise<void> {
    await this.growthCard.click();
  }

  async openSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
}
