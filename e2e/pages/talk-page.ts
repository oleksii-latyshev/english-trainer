import type { Locator, Page } from '@playwright/test';
import { Chat } from '../components/chat';
import { Composer } from '../components/composer';
import { PlannerPanel } from '../components/planner-panel';
import { Recorder } from '../components/recorder';
import { RescuePanel } from '../components/rescue-panel';
import { SpokenRecall } from '../components/spoken-recall';
import { UsageReview } from '../components/usage-review';
import { openingQuestion } from '../data/sessions';

export class TalkPage {
  readonly chat: Chat;
  readonly composer: Composer;
  readonly recorder: Recorder;
  readonly planner: PlannerPanel;
  readonly rescue: RescuePanel;
  readonly usageReview: UsageReview;
  readonly spokenRecall: SpokenRecall;
  readonly openingQuestion: Locator;
  readonly finishButton: Locator;
  readonly reply: Locator;
  readonly exactReply: Locator;
  readonly beingChecked: Locator;
  readonly learnerMessages: Locator;
  readonly writeHeading: Locator;
  readonly reviewWritingButton: Locator;
  readonly reviewWritingHeading: Locator;
  readonly reviewSpeakingButton: Locator;
  readonly reviewSpeakingHeading: Locator;
  readonly writtenAnswerOne: Locator;
  readonly readyToSpeakButton: Locator;
  readonly originalQuestion: Locator;
  readonly microphoneStatus: Locator;
  readonly writtenAnswers: Locator;
  readonly spokenAnswers: Locator;
  readonly writtenAnswerCard: Locator;
  readonly listening: Locator;
  readonly listeningAny: Locator;
  readonly thinking: Locator;
  readonly speakAnywayButton: Locator;
  readonly flowButton: Locator;
  readonly autoListenToggle: Locator;
  readonly autoListenSwitch: Locator;
  readonly voiceFailureNotice: Locator;
  readonly timingButton: Locator;
  readonly timingDialog: Locator;
  readonly practiceComplete: Locator;
  readonly preparingQuestions: Locator;

  constructor(private readonly page: Page) {
    this.chat = new Chat(page);
    this.composer = new Composer(page);
    this.recorder = new Recorder(page);
    this.planner = new PlannerPanel(page);
    this.rescue = new RescuePanel(page);
    this.usageReview = new UsageReview(page);
    this.spokenRecall = new SpokenRecall(page);
    this.openingQuestion = page.getByText(openingQuestion);
    this.finishButton = page.getByRole('button', { name: 'Finish', exact: true });
    this.reply = page.getByText('That sounds useful.');
    this.exactReply = page.getByText('That sounds useful.', { exact: true });
    this.beingChecked = page.getByRole('img', { name: 'Being checked' });
    this.learnerMessages = page.getByRole('article', { name: 'You said' });
    this.writeHeading = page.getByRole('heading', { name: 'Write your answer' });
    this.reviewWritingButton = page.getByRole('button', { name: 'Review writing' });
    this.reviewSpeakingButton = page.getByRole('button', { name: 'Review speaking' });
    this.reviewWritingHeading = page.getByRole('heading', { name: 'Review writing' });
    this.reviewSpeakingHeading = page.getByRole('heading', { name: 'Review speaking' });
    this.writtenAnswerOne = page.getByText('Written answer 1');
    this.readyToSpeakButton = page.getByRole('button', { name: 'Ready to speak' });
    this.originalQuestion = page.getByText('Original question 1 of 1');
    this.microphoneStatus = page.getByRole('status', { name: 'Microphone status' });
    this.writtenAnswers = page.getByRole('region', { name: 'Written answers' });
    this.spokenAnswers = page.getByRole('region', { name: 'Spoken answers' });
    this.writtenAnswerCard = this.writtenAnswers.getByRole('article');
    this.listening = page.getByRole('heading', { name: 'Listening…', exact: true });
    this.listeningAny = page.getByRole('heading', { name: /^Listening/u });
    this.thinking = page.getByRole('heading', { name: 'Thinking', exact: true });
    this.speakAnywayButton = page.getByRole('button', { name: 'Speak anyway', exact: true });
    this.flowButton = page.getByRole('button', { name: /^Hands-free/u });
    this.autoListenToggle = page.getByText('Listen after Eva speaks', { exact: true });
    this.autoListenSwitch = page.getByRole('switch', { name: 'Listen after Eva speaks' });
    this.voiceFailureNotice = page.getByText(
      'Eva’s voice could not play. The reply stays on screen; try Hear it or continue speaking.',
      { exact: true },
    );
    this.timingButton = page.getByLabel('Speech pipeline timing', { exact: true });
    this.timingDialog = page.getByRole('dialog', { name: 'Speech pipeline timing' });
    this.practiceComplete = page.getByText('Practice complete', { exact: true });
    this.preparingQuestions = page.getByText('Preparing five questions…');
  }

  questionProgress(current: number, total: number): Locator {
    return this.page.getByText(new RegExp(`Question ${current} of ${total}`));
  }

  writtenAnswersContain(text: string): Locator {
    return this.writtenAnswers.getByText(text);
  }

  spokenAnswersContain(text: string): Locator {
    return this.spokenAnswers.getByText(text);
  }

  get typeInsteadButton(): Locator {
    return this.composer.typeInsteadButton;
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  async reviewWriting(): Promise<void> {
    await this.reviewWritingButton.click();
  }

  async reviewSpeaking(): Promise<void> {
    await this.reviewSpeakingButton.click();
  }

  async readyToSpeak(): Promise<void> {
    await this.readyToSpeakButton.click();
  }

  async turnOnAutoListen(): Promise<void> {
    await this.flowButton.click();
    await this.autoListenToggle.click();
  }

  async focusConversation(): Promise<void> {
    await this.page.getByText(openingQuestion, { exact: true }).click();
  }

  async focusThinking(): Promise<void> {
    await this.thinking.click({ force: true });
  }

  async speakAnyway(): Promise<void> {
    await this.speakAnywayButton.click();
  }

  async pressShortcut(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async pressSpaceOnPage(): Promise<void> {
    await this.page.locator('body').press('Space');
  }

  async tapSpace(): Promise<void> {
    await this.page.keyboard.down(' ');
    await this.page.keyboard.up(' ');
  }

  async openTiming(): Promise<void> {
    await this.timingButton.click();
  }
}
