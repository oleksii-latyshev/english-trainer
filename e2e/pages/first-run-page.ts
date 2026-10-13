import type { Locator, Page } from '@playwright/test';

export class FirstRunPage {
  readonly allowMicrophone: Locator;
  readonly continueButton: Locator;
  readonly backButton: Locator;
  readonly startTalking: Locator;
  readonly skip: Locator;
  readonly steps: Locator;
  readonly providers: Locator;
  readonly voices: Locator;
  readonly keyField: Locator;

  constructor(private readonly page: Page) {
    this.allowMicrophone = page.getByRole('button', { name: 'Allow Microphone' });
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.backButton = page.getByRole('button', { name: 'Back', exact: true });
    this.startTalking = page.getByRole('button', { name: 'Start Talking' });
    this.skip = page.getByRole('button', { name: 'Skip setup' });
    this.steps = page.getByRole('list', { name: 'Setup steps' });
    this.providers = page.getByRole('radiogroup', { name: 'Conversation AI' });
    this.voices = page.getByRole('radiogroup', { name: 'Voice', exact: true });
    this.keyField = page.getByLabel('API key');
  }

  async openFromSettings(): Promise<void> {
    await this.page.getByRole('button', { name: 'Setup details' }).click();
    await this.page.getByRole('button', { name: 'Run setup again' }).click();
  }

  provider(name: string): Locator {
    return this.providers.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  voice(name: string): Locator {
    return this.voices.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  speed(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }
}
