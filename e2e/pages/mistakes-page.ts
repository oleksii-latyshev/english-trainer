import type { Locator, Page } from '@playwright/test';

export class MistakesPage {
  readonly heading: Locator;
  readonly overview: Locator;
  readonly emptyState: Locator;
  readonly talkItThrough: Locator;
  readonly practiseAll: Locator;
  readonly practiseThis: Locator;
  readonly hearIt: Locator;
  readonly archive: Locator;
  readonly retry: Locator;
  readonly back: Locator;
  readonly preparingLesson: Locator;
  readonly lesson: Locator;
  readonly versionToKeep: Locator;
  readonly question: Locator;
  readonly eyebrow: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Mistakes', exact: true });
    this.overview = page.getByText(/mistakes? in \d+ rules?/);
    this.emptyState = page.getByText('No mistakes yet');
    this.talkItThrough = page.getByRole('button', { name: 'Talk it through' });
    this.practiseAll = page.getByRole('button', { name: /^Practise \d+ · 5 min/ });
    this.practiseThis = page.getByRole('button', { name: 'Practise this' });
    this.hearIt = page.getByRole('button', { name: 'Hear it' });
    this.archive = page.getByRole('button', { name: 'Archive' });
    this.retry = page.getByRole('button', { name: 'Retry' });
    this.back = page.getByRole('main').getByRole('button', { name: 'Mistakes', exact: true });
    this.preparingLesson = page.getByText('Preparing the lesson…');
    this.lesson = page.getByRole('region', { name: 'Lesson' });
    this.question = page.getByText('What did you enjoy about studying at university?');
    this.eyebrow = page.getByText('Eva asked');
    this.versionToKeep = page.getByRole('region', { name: 'Mistake' });
  }

  practiseRule(title: string): Locator {
    return this.group(title).getByRole('button', { name: 'Practise this rule' });
  }

  group(title: string): Locator {
    return this.page.getByRole('region', { name: title });
  }

  row(said: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${said}`) });
  }

  async open(said: string): Promise<void> {
    await this.row(said).click();
  }
}
