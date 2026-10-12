import { ipcFailureMessage, type PersonalProfile } from '@/core/ipc';
import type { SavePersonalProfileFailure } from '../../types';

export const MAX_PROFILE_FIELD_CHARS = 150;

export const PROFILE_FIELDS = [
  { key: 'role', label: 'Role' },
  { key: 'stack', label: 'Stack' },
  { key: 'interests', label: 'Interests' },
  { key: 'goals', label: 'Goals' },
] as const satisfies readonly { key: keyof PersonalProfile; label: string }[];

export const EMPTY_PROFILE_SUMMARY = 'Add a little context so Eva can ask more relevant questions.';

export function fieldLength(value: string): number {
  return Array.from(value).length;
}

export function exceedsFieldLimit(profile: PersonalProfile): boolean {
  return PROFILE_FIELDS.some(({ key }) => fieldLength(profile[key]) > MAX_PROFILE_FIELD_CHARS);
}

export function profileSummary(profile: PersonalProfile): string {
  const values = PROFILE_FIELDS.map(({ key }) => profile[key]).filter((value) => value.trim());
  return values.length ? values.join(' · ') : EMPTY_PROFILE_SUMMARY;
}

export const PROFILE_TOO_LONG = `Each field must be ${MAX_PROFILE_FIELD_CHARS} characters or fewer.`;

export const SAVE_FAILED = 'Your profile could not be saved. Please try again.';

export function saveProblemMessage(failure: SavePersonalProfileFailure): string {
  if (failure._tag === 'ProfileTooLong') return PROFILE_TOO_LONG;
  return ipcFailureMessage(failure, SAVE_FAILED);
}
