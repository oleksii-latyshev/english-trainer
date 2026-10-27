import type { TranslationStatus } from '@/core/ipc';

export const CHECKING_AVAILABILITY = 'Checking language availability…';
export const AVAILABILITY_UNREADABLE = 'Translation availability could not be checked. Retry.';

type AvailabilityTone = 'ready' | 'neutral';

type AvailabilityCopy = { text: string; tone: AvailabilityTone };

export function availabilityCopy(status: TranslationStatus, selectedLanguage: string) {
  if (status.native_language !== selectedLanguage) {
    return { text: CHECKING_AVAILABILITY, tone: 'neutral' } satisfies AvailabilityCopy;
  }
  return {
    text: status.message,
    tone: status.status === 'installed' ? 'ready' : 'neutral',
  } satisfies AvailabilityCopy;
}

export function needsPreparation(status: TranslationStatus, selectedLanguage: string): boolean {
  return status.native_language === selectedLanguage && status.status === 'download_required';
}
