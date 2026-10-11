import type { Locator, Page } from '@playwright/test';

export class TranslationDialog {
  readonly dialog: Locator;
  readonly input: Locator;
  readonly translateButton: Locator;
  readonly retryButton: Locator;
  readonly prepareButton: Locator;
  readonly alert: Locator;
  readonly pendingStatus: Locator;
  private readonly openButton: Locator;
  private readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Translate a word' });
    this.input = this.dialog.getByRole('textbox', { name: 'English word' });
    this.translateButton = this.dialog.getByRole('button', { name: 'Translate', exact: true });
    this.retryButton = this.dialog.getByRole('button', { name: 'Retry', exact: true });
    this.prepareButton = this.dialog.getByRole('button', { name: 'Prepare languages' });
    this.alert = this.dialog.getByRole('alert');
    this.pendingStatus = this.dialog.getByRole('status').filter({ hasText: 'Translating useful' });
    this.openButton = page.getByRole('button', { name: 'Translate a word', exact: true });
    this.closeButton = page.getByRole('button', { name: 'Close translation' });
  }

  offerFor(word: string): Locator {
    return this.page.getByRole('button', { name: `Translate “${word}”` });
  }

  get anyOffer(): Locator {
    return this.page.getByRole('button', { name: /^Translate “/ });
  }

  text(value: string | RegExp): Locator {
    return this.dialog.getByText(value);
  }

  get explanationRetryButton(): Locator {
    return this.dialog.getByRole('button', { name: /Retry/ });
  }

  async open(): Promise<void> {
    await this.openButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async lookUp(word: string): Promise<void> {
    await this.input.fill(word);
    await this.translateButton.click();
  }

  async submitWithKeyboard(word: string): Promise<void> {
    await this.input.fill(word);
    await this.input.press('Enter');
  }

  async dismissWithKeyboard(): Promise<void> {
    await this.input.press('Escape');
  }

  async translateSelected(word: string): Promise<void> {
    await this.offerFor(word).click();
  }

  async select(scope: Locator, word: string): Promise<void> {
    await scope.evaluate((element, selectedText) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const offset = (node.textContent ?? '').indexOf(selectedText);
        if (offset >= 0) {
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + selectedText.length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          document.dispatchEvent(new Event('selectionchange'));
          return;
        }
        node = walker.nextNode();
      }
      throw new Error('Selection text was not present.');
    }, word);
  }
}
