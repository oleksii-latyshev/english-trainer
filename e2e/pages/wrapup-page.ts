import { expect, type Locator, type Page } from '@playwright/test';

const CAPTURE_BUFFER_MS = 400;

export class WrapupPage {
  readonly heading: Locator;
  readonly talkMoreButton: Locator;
  readonly doneButton: Locator;
  readonly pendingCoaching: Locator;
  readonly speakingTimeLabel: Locator;
  readonly noSpokenAnswers: Locator;
  readonly debrief: Locator;
  readonly progress: Locator;
  readonly summary: Locator;
  readonly undoButton: Locator;
  readonly practiseRule: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' });
    this.talkMoreButton = page.getByRole('button', { name: 'Talk more' });
    this.doneButton = page.getByRole('button', { name: 'Done' });
    this.pendingCoaching = page.getByText('Still checking 1 answer…');
    this.speakingTimeLabel = page.getByText('Speaking time', { exact: true });
    this.noSpokenAnswers = page.getByText('no spoken answers to time', { exact: true });
    this.debrief = page.getByRole('region', { name: 'Debrief', exact: true });
    this.progress = this.debrief.getByRole('status').filter({ hasText: /^\d+ \/ \d+$/ });
    this.summary = this.debrief.getByRole('region', { name: 'Debrief summary' });
    this.practiseRule = this.summary.getByRole('button', { name: 'Practise this rule' });
    this.undoButton = page.getByRole('button', { name: 'Undo' });
  }

  review(sequence: number): Locator {
    return this.debrief.getByRole('region', { name: `Review of answer ${sequence}` });
  }

  summaryLine(text: string): Locator {
    return this.page.getByText(text);
  }

  async next(): Promise<void> {
    await this.debrief.getByRole('button', { name: /^(Next|Finish)$/ }).click();
  }

  async back(): Promise<void> {
    await this.debrief.getByRole('button', { name: 'Back' }).click();
  }

  take(phrase: string): Locator {
    return this.debrief.getByRole('button', { name: `Take “${phrase}”` });
  }

  taken(phrase: string): Locator {
    return this.debrief.getByRole('button', { name: `Taken “${phrase}”` });
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
