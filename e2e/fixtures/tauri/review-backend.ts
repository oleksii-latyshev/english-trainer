import type { Page } from '@playwright/test';
import type { LearningMemoryView, ReviewMaterials } from '@/core/ipc';
import { reviewMemory, reviewMemoryWithDuePhrase } from '../../data/review-memory';
import { installReview, type ReviewOptions } from './review';

export class ReviewBackend {
  enabled = false;
  private options: ReviewOptions = {};

  constructor(private readonly page: Page) {}

  withDuePhrase(): this {
    this.enabled = true;
    return this;
  }

  withCompletedRunAndDuePhrase(): this {
    return this.configure({ completedRunWithDuePhrase: true });
  }

  withEmptyWarmup(): this {
    return this.configure({ emptyWarmup: true });
  }

  failingPreparationOnce(): this {
    return this.configure({ failPreparationOnce: true });
  }

  holdingInitialFinish(): this {
    return this.configure({ holdInitialFinish: true });
  }

  holdingPreparation(): this {
    return this.configure({ holdPreparation: true });
  }

  throwingOnPreparation(): this {
    return this.configure({ throwPreparation: true });
  }

  failingReveal(): this {
    return this.configure({ failReveal: true });
  }

  withSilentAudio(): this {
    return this.configure({ silentAudio: true });
  }

  get memory(): LearningMemoryView {
    return this.options.completedRunWithDuePhrase ? reviewMemoryWithDuePhrase : reviewMemory;
  }

  async install(): Promise<void> {
    if (this.enabled) await installReview(this.page, this.options);
  }

  calls(): Promise<string[]> {
    return this.page.evaluate(() => window.__ET_REVIEW__.calls);
  }

  materials(): Promise<ReviewMaterials> {
    return this.page.evaluate(() => window.__ET_REVIEW__.materials);
  }

  async completePreparation(): Promise<void> {
    await this.page.evaluate(() => window.__ET_REVIEW__.completePreparation());
  }

  async completeFinish(success: boolean): Promise<void> {
    await this.page.evaluate((outcome) => window.__ET_REVIEW__.completeFinish(outcome), success);
  }

  private configure(change: ReviewOptions): this {
    this.enabled = true;
    this.options = { ...this.options, ...change };
    return this;
  }
}
