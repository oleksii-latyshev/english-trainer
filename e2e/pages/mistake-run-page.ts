import { expect, type Locator, type Page } from '@playwright/test';

const CAPTURE_BUFFER_MS = 350;

export class MistakeRunPage {
  readonly endPractice: Locator;
  readonly gapField: Locator;
  readonly fixField: Locator;
  readonly submit: Locator;
  readonly tryOnceMore: Locator;
  readonly checkIt: Locator;
  readonly retryCheck: Locator;
  readonly next: Locator;
  readonly finish: Locator;
  readonly recordAnswer: Locator;
  readonly stopRecording: Locator;
  readonly hearQuestion: Locator;
  readonly backToMistakes: Locator;
  readonly summary: Locator;
  readonly notQuite: Locator;
  readonly right: Locator;
  readonly checking: Locator;
  readonly checkFailed: Locator;
  readonly practiceOnly: Locator;

  constructor(private readonly page: Page) {
    this.endPractice = page.getByRole('button', { name: 'End practice' });
    this.gapField = page.getByRole('textbox', { name: 'Missing words' });
    this.fixField = page.getByRole('textbox', { name: 'Your corrected sentence' });
    this.submit = page.getByRole('button', { name: 'Submit' });
    this.tryOnceMore = page.getByRole('button', { name: 'Try once more' });
    this.checkIt = page.getByRole('button', { name: 'Check it' });
    this.retryCheck = page.getByRole('button', { name: 'Retry' });
    this.next = page.getByRole('button', { name: 'Next →' });
    this.finish = page.getByRole('button', { name: 'Finish' });
    this.recordAnswer = page.getByRole('button', { name: 'Record answer' });
    this.stopRecording = page.getByRole('button', { name: 'Stop recording' });
    this.hearQuestion = page.getByRole('button', { name: 'Hear the question' });
    this.backToMistakes = page.getByRole('button', { name: 'Back to Mistakes' });
    this.summary = page.getByRole('region', { name: 'Practice summary' });
    this.notQuite = page.getByText('Not quite — here is the version to keep.');
    this.right = page.getByText('Right.', { exact: true });
    this.checking = page.getByText('Eva is checking your answer.');
    this.checkFailed = page.getByText('We could not check this answer.');
    this.practiceOnly = page.getByText('Practice only. It does not change your schedule.');
  }

  exercise(step: string): Locator {
    return this.page.getByRole('region', { name: step });
  }

  progress(position: number, total: number): Locator {
    return this.page.getByRole('img', { name: `Exercise ${position} of ${total}` });
  }

  position(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  async fillGap(words: string): Promise<void> {
    await this.gapField.fill(words);
    await this.submit.click();
  }

  async fixSentence(sentence: string): Promise<void> {
    await this.fixField.fill(sentence);
    await this.submit.click();
  }

  async answerAloud(): Promise<void> {
    await this.recordAnswer.click();
    await expect(this.stopRecording).toBeEnabled();
    await this.page.waitForTimeout(CAPTURE_BUFFER_MS);
    await this.stopRecording.click();
  }

  summaryRow(text: string): Locator {
    return this.summary.getByRole('listitem').filter({ hasText: text });
  }
}
