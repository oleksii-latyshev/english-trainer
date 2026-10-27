import { ipcFailureMessage, type PersonalProfile } from '@/core/ipc';
import type { SavePersonalProfileFailure } from '../../types';

const MAX_PROFILE_FIELD_CHARS = 150;
const MAX_PROFILE_NAME_CHARS = 40;

type ProfileField = {
  readonly key: keyof PersonalProfile;
  readonly label: string;
  readonly limit: number;
  readonly hint?: string;
};

export const PROFILE_FIELDS: readonly ProfileField[] = [
  { key: 'name', label: 'Name', limit: MAX_PROFILE_NAME_CHARS, hint: 'what Eva calls you' },
  { key: 'role', label: 'Role', limit: MAX_PROFILE_FIELD_CHARS },
  { key: 'stack', label: 'Stack', limit: MAX_PROFILE_FIELD_CHARS },
  { key: 'interests', label: 'Interests', limit: MAX_PROFILE_FIELD_CHARS },
  { key: 'goals', label: 'Goals', limit: MAX_PROFILE_FIELD_CHARS },
];

export const EMPTY_PROFILE_SUMMARY = 'Add a little context so Eva can ask more relevant questions.';

export function fieldLength(value: string): number {
  return Array.from(value).length;
}

export function firstFieldOverLimit(profile: PersonalProfile): ProfileField | undefined {
  return PROFILE_FIELDS.find(({ key, limit }) => fieldLength(profile[key].trim()) > limit);
}

export function learnerName(profile: PersonalProfile): string {
  return profile.name.trim();
}

export function profileSummary(profile: PersonalProfile): string {
  const values = PROFILE_FIELDS.map(({ key }) => profile[key]).filter((value) => value.trim());
  return values.length ? values.join(' · ') : EMPTY_PROFILE_SUMMARY;
}

export const SAVE_FAILED = 'Your profile could not be saved. Please try again.';

function profileTooLongMessage(failure: { field: string; limit: number }): string {
  return `${failure.field} must be ${failure.limit} characters or fewer.`;
}

export function saveProblemMessage(failure: SavePersonalProfileFailure): string {
  if (failure._tag === 'ProfileTooLong') return profileTooLongMessage(failure);
  return ipcFailureMessage(failure, SAVE_FAILED);
}
