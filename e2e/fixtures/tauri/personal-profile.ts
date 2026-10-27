import type { Page } from '@playwright/test';
import type { PersonalProfile } from '@/core/ipc';

const emptyProfile: PersonalProfile = { name: '', role: '', stack: '', interests: '', goals: '' };

export class PersonalProfileBackend {
  private seed: PersonalProfile = emptyProfile;

  constructor(private readonly page: Page) {}

  with(profile: Partial<PersonalProfile>): this {
    this.seed = { ...emptyProfile, ...profile };
    return this;
  }

  async install(): Promise<void> {
    await this.page.addInitScript((initial: PersonalProfile) => {
      const internals = window.__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      let stored = initial;
      internals.invoke = async (command, args = {}) => {
        if (command !== 'get_personal_profile' && command !== 'save_personal_profile') {
          return invoke(command, args);
        }
        window.__ET_HARNESS__.calls.push({ command, args });
        if (command === 'save_personal_profile') {
          const profile: unknown = Reflect.get(args, 'profile');
          if (typeof profile !== 'object' || profile === null)
            throw new Error('Harness received an invalid profile.');
          const field = (key: keyof PersonalProfile): string => {
            const value: unknown = Reflect.get(profile, key);
            return typeof value === 'string' ? value.trim() : '';
          };
          stored = {
            name: field('name'),
            role: field('role'),
            stack: field('stack'),
            interests: field('interests'),
            goals: field('goals'),
          };
        }
        return stored;
      };
    }, this.seed);
  }
}
