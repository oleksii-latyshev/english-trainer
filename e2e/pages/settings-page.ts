import type { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly voice: Locator;
  readonly previewButton: Locator;
  readonly nativeLanguage: Locator;
  readonly statusFailure: Locator;
  readonly runTestButton: Locator;
  readonly usageHeading: Locator;

  constructor(private readonly page: Page) {
    this.voice = page.getByLabel("Eva's voice", { exact: true });
    this.previewButton = page.getByRole('button', { name: 'Preview', exact: true });
    this.nativeLanguage = page.getByRole('combobox', { name: 'Native language' });
    this.runTestButton = page.getByRole('button', { name: 'Run test' });
    this.usageHeading = page.getByRole('heading', { name: 'Usage', exact: true });
    this.statusFailure = page.getByText('Translation availability could not be checked. Retry.');
  }

  speed(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  async chooseVoice(value: string): Promise<void> {
    await this.voice.selectOption(value);
  }

  async chooseSpeed(label: string): Promise<void> {
    await this.speed(label).click();
  }

  async preview(): Promise<void> {
    await this.previewButton.click();
  }

  async chooseNativeLanguage(code: string): Promise<void> {
    await this.nativeLanguage.selectOption(code);
  }

  provider(name: string): Locator {
    return this.page.getByRole('radio', { name });
  }

  async chooseProvider(name: string): Promise<void> {
    await this.provider(name).click({ force: true });
  }

  async chooseFromSelect(label: string, option: string): Promise<void> {
    await this.page.getByRole('combobox', { name: label }).click();
    await this.page.getByRole('option', { name: option }).click();
  }

  async runTest(): Promise<void> {
    await this.runTestButton.click();
  }
}
