import { expect, type Locator, type Page } from '@playwright/test';

const CAPTURE_BUFFER_MS = 400;

export class SpokenRecall {
  readonly panel: Locator;
  readonly recorder: Locator;
  readonly startButton: Locator;
  readonly recordButton: Locator;
  readonly stopButton: Locator;
  readonly saveButton: Locator;
  readonly leaveButton: Locator;
  readonly returnButton: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.getByRole('region', { name: 'Spoken phrase recall' });
    this.recorder = page.getByRole('region', { name: 'Phrase recall cue' });
    this.startButton = this.panel.getByRole('button', { name: 'Start spoken recall' });
    this.recordButton = this.recorder.getByRole('button', { name: 'Start recording' });
    this.stopButton = this.recorder.getByRole('button', { name: 'Stop recording' });
    this.saveButton = this.panel.getByRole('button', { name: 'Save spoken recall' });
    this.leaveButton = this.panel.getByRole('button', { name: 'Leave recall' });
    this.returnButton = this.panel.getByRole('button', { name: 'Return to conversation' });
  }

  async recordAnswer(): Promise<void> {
    await this.recordButton.click();
    await expect(this.stopButton).toBeEnabled();
    await this.page.waitForTimeout(CAPTURE_BUFFER_MS);
    await this.stopButton.click();
  }
}
