import type { Locator, Page } from '@playwright/test';

export class Composer {
  readonly answer: Locator;
  readonly typeInsteadButton: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.answer = page.getByRole('textbox', { name: 'Your answer to Eva' });
    this.typeInsteadButton = page.getByRole('button', { name: 'Type instead', exact: true });
    this.sendButton = page.getByRole('button', { name: 'Send', exact: true });
  }

  async typeInstead(): Promise<void> {
    await this.typeInsteadButton.click();
  }

  async write(text: string): Promise<void> {
    await this.answer.fill(text);
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }

  async writeAndSend(text: string): Promise<void> {
    await this.write(text);
    await this.send();
  }

  async typeInsteadAndSend(text: string): Promise<void> {
    await this.typeInstead();
    await this.writeAndSend(text);
  }
}
