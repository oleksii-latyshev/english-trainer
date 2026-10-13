import type { Locator, Page } from '@playwright/test';
import { Recorder } from '../components/recorder';

export class ReviewPage {
  readonly recorder: Recorder;
  readonly situation: Locator;
  readonly cue: Locator;
  readonly modelAnswer: Locator;
  readonly showPhraseButton: Locator;
  readonly revealedPhrase: Locator;
  readonly hintNotice: Locator;
  readonly revealFailure: Locator;
  readonly skipButton: Locator;
  readonly retrySituationsButton: Locator;
  readonly preparationFailure: Locator;
  readonly shadowButton: Locator;
  readonly finishButton: Locator;
  readonly endReviewButton: Locator;
  readonly lateProvisional: Locator;
  private readonly spokenReviewRegion: Locator;

  constructor(page: Page) {
    this.recorder = new Recorder(page);
    this.spokenReviewRegion = page.getByRole('region', { name: 'Spoken review', exact: true });
    this.situation = page.getByText('Your team has two good ideas. Suggest how to agree on one.');
    this.cue = page.getByText('Agree on a solution.', { exact: true });
    this.modelAnswer = page.getByText('Could we find a compromise?');
    this.showPhraseButton = page.getByRole('button', { name: 'Show phrase' });
    this.revealedPhrase = page.getByText('find a compromise', { exact: true });
    this.hintNotice = page.getByText('Practice with a hint — not independent use.');
    this.revealFailure = page.getByText('Could not show the phrase. Please try again.');
    this.skipButton = page.getByRole('button', { name: 'Skip' });
    this.retrySituationsButton = page.getByRole('button', { name: 'Retry situations' });
    this.preparationFailure = page.getByText('The review service timed out. Try again.');
    this.shadowButton = page.getByRole('button', { name: 'Shadow it' });
    this.finishButton = page.getByRole('button', { name: 'Finish', exact: true });
    this.endReviewButton = page.getByRole('button', { name: 'End review' });
    this.lateProvisional = page.getByText('A late provisional suggestion');
  }

  async reviewNow(): Promise<void> {
    await this.spokenReviewRegion.getByRole('button', { name: 'Start spoken review' }).click();
  }

  async showPhrase(): Promise<void> {
    await this.showPhraseButton.click();
  }

  async retrySituations(): Promise<void> {
    await this.retrySituationsButton.click();
  }

  async shadow(): Promise<void> {
    await this.shadowButton.click();
  }

  async startRecording(): Promise<void> {
    await this.recorder.start();
  }
}
