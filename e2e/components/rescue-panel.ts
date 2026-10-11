import type { Locator, Page } from '@playwright/test';

export class RescuePanel {
  readonly stuckButton: Locator;
  readonly prompt: Locator;
  readonly saySimplerButton: Locator;
  readonly missingWordButton: Locator;
  readonly description: Locator;
  readonly findWordButton: Locator;
  readonly retryButton: Locator;
  readonly continueSpeakingButton: Locator;
  readonly keepListeningButton: Locator;
  readonly doneThinkingButton: Locator;
  readonly heldOpenStatus: Locator;

  constructor(private readonly page: Page) {
    this.stuckButton = page.getByRole('button', { name: 'Stuck' });
    this.prompt = page.getByText('Need a little help?', { exact: true });
    this.saySimplerButton = page.getByRole('button', { name: 'Say it simpler', exact: true });
    this.missingWordButton = page.getByRole('button', { name: 'Missing word', exact: true });
    this.description = page.getByRole('textbox', { name: 'Describe the word in English' });
    this.findWordButton = page.getByRole('button', { name: 'Find a word', exact: true });
    this.retryButton = page.getByRole('button', { name: 'Retry', exact: true });
    this.continueSpeakingButton = page.getByRole('button', {
      name: 'Continue speaking',
      exact: true,
    });
    this.keepListeningButton = page.getByRole('button', { name: 'Keep listening', exact: true });
    this.doneThinkingButton = page.getByRole('button', { name: 'Done thinking', exact: true });
    this.heldOpenStatus = page
      .getByRole('status')
      .getByText('Listening, turn held open', { exact: true });
  }

  message(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  candidate(word: string): Locator {
    return this.page.getByRole('button', { name: word, exact: true });
  }

  selectedCandidate(word: string): Locator {
    return this.page.getByRole('status').getByText(word, { exact: true });
  }
}
