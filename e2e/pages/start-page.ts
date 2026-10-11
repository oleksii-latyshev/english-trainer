import type { Locator, Page } from '@playwright/test';

export class StartPage {
  readonly heading: Locator;
  readonly startButton: Locator;
  readonly tryAgainButton: Locator;
  readonly openConversation: Locator;
  readonly warmupToggle: Locator;
  readonly skipWarmupButton: Locator;
  readonly retryFinishButton: Locator;
  readonly emptyWarmupHeading: Locator;
  readonly topicField: Locator;
  private readonly continueButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'What shall we talk about?' });
    this.startButton = page.getByRole('button', { name: 'Start talking' });
    this.tryAgainButton = page.getByRole('button', { name: 'Try again' });
    this.openConversation = page.getByRole('region', { name: 'Open conversation' });
    this.warmupToggle = page.getByRole('button', { name: 'Before session' });
    this.skipWarmupButton = page.getByRole('button', { name: 'Skip and start conversation' });
    this.retryFinishButton = page.getByRole('button', { name: 'Retry finish' });
    this.emptyWarmupHeading = page.getByRole('heading', { name: 'Nothing to review right now' });
    this.topicField = page.getByLabel('What would you like to talk about?');
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  }

  async chooseFreeTopic(): Promise<void> {
    await this.page.getByRole('button', { name: 'Free topic' }).click();
  }

  async describeTopic(subject: string): Promise<void> {
    await this.topicField.fill(subject);
  }

  async chooseLength(minutes: 5 | 10 | 15): Promise<void> {
    await this.page.getByRole('button', { name: `${minutes} min`, exact: true }).click();
  }

  async chooseTextChat(): Promise<void> {
    await this.page.getByRole('button', { name: /^Text chat/ }).click();
  }

  async chooseWriteThenSpeak(): Promise<void> {
    await this.page.getByRole('button', { name: /^Write, then speak/ }).click();
  }

  async chooseWarmupFirst(): Promise<void> {
    await this.warmupToggle.click();
  }

  async start(): Promise<void> {
    await this.startButton.click();
  }

  async startWriting(): Promise<void> {
    await this.page.getByRole('button', { name: 'Start writing' }).click();
  }

  async startTextChat(): Promise<void> {
    await this.page.getByRole('button', { name: 'Start text chat', exact: true }).click();
  }

  async continueSession(): Promise<void> {
    await this.continueButton.click();
  }

  async tryAgain(): Promise<void> {
    await this.tryAgainButton.click();
  }

  async skipWarmup(): Promise<void> {
    await this.skipWarmupButton.click();
  }

  async retryFinish(): Promise<void> {
    await this.retryFinishButton.click();
  }
}
