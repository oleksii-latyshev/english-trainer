import { test as base, expect } from '@playwright/test';
import { App } from '../pages/app';
import { FirstRunPage } from '../pages/first-run-page';
import { GrowthPage } from '../pages/growth-page';
import { MemoryPage } from '../pages/memory-page';
import { MistakesPage } from '../pages/mistakes-page';
import { ReviewPage } from '../pages/review-page';
import { SettingsPage } from '../pages/settings-page';
import { StartPage } from '../pages/start-page';
import { TalkPage } from '../pages/talk-page';
import { WrapupPage } from '../pages/wrapup-page';
import { FakeBackend } from './tauri';

type Fixtures = {
  tauri: FakeBackend;
  app: App;
  start: StartPage;
  growth: GrowthPage;
  talk: TalkPage;
  wrapup: WrapupPage;
  memory: MemoryPage;
  mistakes: MistakesPage;
  review: ReviewPage;
  settings: SettingsPage;
  firstRun: FirstRunPage;
};

export const test = base.extend<Fixtures>({
  tauri: async ({ page }, use, testInfo) => {
    const backend = new FakeBackend(page);
    await use(backend);
    if (testInfo.status !== 'passed' || backend.toleratesUnhandledCommands) return;
    await expect.poll(() => backend.unhandledCommandErrors()).toEqual([]);
  },
  app: async ({ page, tauri }, use) => {
    await use(new App(page, tauri));
  },
  start: async ({ page }, use) => {
    await use(new StartPage(page));
  },
  growth: async ({ page }, use) => {
    await use(new GrowthPage(page));
  },
  talk: async ({ page }, use) => {
    await use(new TalkPage(page));
  },
  wrapup: async ({ page }, use) => {
    await use(new WrapupPage(page));
  },
  memory: async ({ page }, use) => {
    await use(new MemoryPage(page));
  },
  mistakes: async ({ page }, use) => {
    await use(new MistakesPage(page));
  },
  review: async ({ page }, use) => {
    await use(new ReviewPage(page));
  },
  settings: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  firstRun: async ({ page }, use) => {
    await use(new FirstRunPage(page));
  },
});

export { expect };
