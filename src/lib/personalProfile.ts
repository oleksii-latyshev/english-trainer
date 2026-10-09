import { invoke } from '@tauri-apps/api/core';
import { isPersonalProfile, type PersonalProfile } from './personalProfileTypes';

export {
  EMPTY_PERSONAL_PROFILE,
  isPersonalProfile,
  type PersonalProfile,
  personalProfileSummary,
} from './personalProfileTypes';

export async function getPersonalProfile(): Promise<PersonalProfile> {
  const result: unknown = await invoke<unknown>('get_personal_profile');
  if (!isPersonalProfile(result)) throw new Error('Unexpected personal profile response.');
  return result;
}

export async function savePersonalProfile(profile: PersonalProfile): Promise<PersonalProfile> {
  if (!isPersonalProfile(profile))
    throw new Error('Profile fields must be 150 characters or fewer.');
  const result: unknown = await invoke<unknown>('save_personal_profile', { profile });
  if (!isPersonalProfile(result)) throw new Error('Unexpected saved profile response.');
  return result;
}
