import type { Locator, Page } from '@playwright/test';
import { Sidebar } from '../components/sidebar';
import { TranslationDialog } from '../components/translation-dialog';
import type { FakeBackend } from '../fixtures/tauri';

export class App {
  readonly sidebar: Sidebar;
  readonly translation: TranslationDialog;
  readonly alert: Locator;

  constructor(
    private readonly page: Page,
    private readonly tauri: FakeBackend,
  ) {
    this.sidebar = new Sidebar(page);
    this.translation = new TranslationDialog(page);
    this.alert = page.getByRole('alert');
  }

  async open(): Promise<void> {
    await this.tauri.install();
    await this.page.goto('/');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  text(value: string | RegExp): Locator {
    return this.page.getByText(value);
  }

  exactText(value: string): Locator {
    return this.page.getByText(value, { exact: true });
  }

  heading(name: string | RegExp, options: { exact?: boolean } = {}): Locator {
    return this.page.getByRole('heading', { name, ...options });
  }

  async pressEscape(): Promise<void> {
    await this.pressKey('Escape');
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async waitForQuietPeriod(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async useFakeClock(): Promise<void> {
    await this.page.clock.install();
  }

  async advanceClock(ms: number): Promise<void> {
    await this.page.clock.fastForward(ms);
  }
}
