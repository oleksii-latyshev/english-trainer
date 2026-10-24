import { expect, type Locator, type Page } from '@playwright/test';

const CAPTURE_BUFFER_MS = 400;

export class WrapupPage {
  readonly heading: Locator;
  readonly talkMoreButton: Locator;
  readonly doneButton: Locator;
  readonly preparingPhrases: Locator;
  readonly pendingCoaching: Locator;
  readonly speakingTimeLabel: Locator;
  readonly noSpokenAnswers: Locator;
  readonly conversation: Locator;
  readonly retryPhrasesButton: Locator;
  readonly noPhrases: Locator;
  readonly savedButton: Locator;
  readonly undoButton: Locator;
  private readonly phrasesRegion: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' });
    this.talkMoreButton = page.getByRole('button', { name: 'Talk more' });
    this.doneButton = page.getByRole('button', { name: 'Done' });
    this.preparingPhrases = page.getByText('Preparing phrases from your answers…');
    this.phrasesRegion = page.getByRole('region', { name: 'Phrases worth learning' });
    this.pendingCoaching = this.phrasesRegion.getByText('Still checking 1 answer…');
    this.speakingTimeLabel = page.getByText('Speaking time', { exact: true });
    this.noSpokenAnswers = page.getByText('no spoken answers to time', { exact: true });
    this.conversation = page.getByRole('region', { name: 'Your conversation' });
    this.retryPhrasesButton = page.getByRole('button', { name: 'Retry phrases' });
    this.noPhrases = page.getByText('No phrases to keep from this session.');
    this.savedButton = page.getByRole('button', { name: 'Saved to Memory' });
    this.undoButton = page.getByRole('button', { name: 'Undo' });
  }

  review(sequence: number): Locator {
    return this.conversation.getByRole('region', { name: `Review of answer ${sequence}` });
  }

  async sayItAgain(sequence: number): Promise<void> {
    await this.review(sequence).getByRole('button', { name: 'Say it again' }).click();
  }

  async stopRecording(sequence: number): Promise<void> {
    const stop = this.review(sequence).getByRole('button', { name: 'Stop recording' });
    await expect(stop).toBeEnabled();
    await this.page.waitForTimeout(CAPTURE_BUFFER_MS);
    await stop.click();
  }

  summaryLine(text: string): Locator {
    return this.page.getByText(text);
  }

  phrase(text: string): Locator {
    return this.page.getByText(text);
  }

  usageNote(text: string): Locator {
    return this.page.getByText(text);
  }

  learnerQuote(text: string): Locator {
    return this.page.getByText(`You said: “${text}”`);
  }

  async removePhrase(phrase: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove phrase “${phrase}”` }).click();
  }

  async saveAll(count: number): Promise<void> {
    await this.page.getByRole('button', { name: `Save all ${count} phrases to Memory` }).click();
  }

  async retryPhrases(): Promise<void> {
    await this.retryPhrasesButton.click();
  }

  async undo(): Promise<void> {
    await this.undoButton.click();
  }

  async done(): Promise<void> {
    await this.doneButton.click();
  }

  async talkMore(): Promise<void> {
    await this.talkMoreButton.click();
  }
}
