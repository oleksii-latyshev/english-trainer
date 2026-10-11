import { expect, type Locator, type Page } from '@playwright/test';

const CAPTURE_BUFFER_MS = 350;

export class Recorder {
  readonly startButton: Locator;
  readonly finishAnswerButton: Locator;
  readonly stopAndReviewButton: Locator;
  readonly replayButton: Locator;
  readonly heardField: Locator;
  readonly liveTranscript: Locator;
  private readonly microphoneLevel: Locator;

  constructor(private readonly page: Page) {
    this.startButton = page.getByRole('button', { name: 'Start speaking', exact: true });
    this.finishAnswerButton = page.getByRole('button', { name: 'Finish answer' });
    this.stopAndReviewButton = page.getByRole('button', { name: 'Stop and review', exact: true });
    this.replayButton = page.getByRole('button', { name: 'Replay', exact: true });
    this.heardField = page.getByRole('textbox', { name: 'What we heard — edit if needed' });
    this.liveTranscript = page.getByRole('article', { name: 'Live transcript', exact: true });
    this.microphoneLevel = page.getByLabel('Microphone level');
  }

  async start(): Promise<void> {
    await this.startButton.click();
  }

  async finishAnswer(): Promise<void> {
    await this.finishAnswerButton.click();
  }

  async stopAndReview(): Promise<void> {
    await this.stopAndReviewButton.click();
  }

  async waitForMicrophoneSignal(): Promise<void> {
    await expect
      .poll(() =>
        this.microphoneLevel.evaluate((element) =>
          element instanceof HTMLMeterElement ? element.value : 0,
        ),
      )
      .toBeGreaterThan(0);
  }

  async startAndWaitForSignal(): Promise<void> {
    await this.start();
    await expect(this.stopAndReviewButton).toBeEnabled();
    await this.waitForMicrophoneSignal();
    await this.page.waitForTimeout(CAPTURE_BUFFER_MS);
  }
}
