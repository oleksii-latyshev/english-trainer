import type { Locator, Page } from '@playwright/test';

export class GrowthPage {
  readonly heading: Locator;
  readonly today: Locator;
  readonly howItGrows: Locator;
  readonly youAreHere: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Eva grows as you speak' });
    this.today = page.getByRole('region', { name: 'Today' });
    this.howItGrows = page.getByRole('region', { name: 'How Eva grows' });
    this.youAreHere = page.getByRole('listitem').filter({ hasText: 'You are here' });
  }
}
