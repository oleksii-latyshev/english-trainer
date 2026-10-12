import type { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly voices: Locator;
  readonly unavailableNotice: Locator;
  readonly nativeLanguage: Locator;
  readonly statusFailure: Locator;

  constructor(private readonly page: Page) {
    this.unavailableNotice = page.getByText('Local voice is unavailable. Using system speech.');
    this.voices = page.getByRole('radiogroup', { name: "Eva's voice" });
    this.nativeLanguage = page.getByRole('combobox', { name: 'Native language' });
    this.statusFailure = page.getByText('Translation availability could not be checked. Retry.');
  }

  speed(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  voice(name: string): Locator {
    return this.voices.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  sampleButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Play ${name} sample`, exact: true });
  }

  async chooseVoice(name: string): Promise<void> {
    await this.voice(name).click();
  }

  async chooseSpeed(label: string): Promise<void> {
    await this.speed(label).click();
  }

  async playSample(name: string): Promise<void> {
    await this.sampleButton(name).click();
  }

  async chooseNativeLanguage(code: string): Promise<void> {
    await this.nativeLanguage.selectOption(code);
  }
}
