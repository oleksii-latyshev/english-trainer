export type PersonalProfile = {
  role: string;
  stack: string;
  interests: string;
  goals: string;
};

export const EMPTY_PERSONAL_PROFILE: PersonalProfile = {
  role: '',
  stack: '',
  interests: '',
  goals: '',
};

function isProfileField(value: unknown): value is string {
  return typeof value === 'string' && Array.from(value).length <= 150;
}

export function isPersonalProfile(value: unknown): value is PersonalProfile {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'role' in value &&
    isProfileField(value.role) &&
    'stack' in value &&
    isProfileField(value.stack) &&
    'interests' in value &&
    isProfileField(value.interests) &&
    'goals' in value &&
    isProfileField(value.goals)
  );
}

export function personalProfileSummary(profile: PersonalProfile): string {
  const values = [profile.role, profile.stack, profile.interests, profile.goals].filter((value) =>
    value.trim(),
  );
  return values.length
    ? values.join(' · ')
    : 'Add a little context so Eva can ask more relevant questions.';
}
