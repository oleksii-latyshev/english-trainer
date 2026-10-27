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
  readonly activity: Locator;
  readonly thisWeek: Locator;
  readonly warmupCard: Locator;
  readonly usualMistakes: Locator;
  private readonly continueButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /^Good (morning|afternoon|evening)(, .+)?$/ });
    this.startButton = page.getByRole('button', { name: 'Start talking' });
    this.tryAgainButton = page.getByRole('button', { name: 'Try again' });
    this.openConversation = page.getByRole('region', { name: 'Open conversation' });
    this.warmupToggle = page.getByRole('button', { name: 'Before session' });
    this.skipWarmupButton = page.getByRole('button', { name: 'Skip and start conversation' });
    this.retryFinishButton = page.getByRole('button', { name: 'Retry finish' });
    this.emptyWarmupHeading = page.getByRole('heading', { name: 'Nothing to review right now' });
    this.activity = page.getByRole('region', { name: 'Speaking activity' });
    this.thisWeek = page.getByRole('region', { name: 'This week' });
    this.warmupCard = page.getByRole('region', { name: 'Phrases to review' });
    this.usualMistakes = page.getByRole('region', { name: 'Your usual mistakes' });
    this.topicField = page.getByLabel('What would you like to talk about?');
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  }

  async chooseFreeTopic(): Promise<void> {
    await this.page.getByRole('button', { name: 'Free topic' }).click();
  }

  async describeTopic(subject: string): Promise<void> {
    await this.topicField.fill(subject);
  }

  async chooseNoLimit(): Promise<void> {
    await this.page.getByRole('button', { name: 'No limit', exact: true }).click();
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

  async practiseUsualMistakes(): Promise<void> {
    await this.usualMistakes.getByRole('button', { name: 'Practice 5 questions' }).click();
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
