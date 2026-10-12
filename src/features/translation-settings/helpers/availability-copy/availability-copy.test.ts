import { expect, it } from 'bun:test';
import type { TranslationStatus } from '@/core/ipc';
import { availabilityCopy, CHECKING_AVAILABILITY, needsPreparation } from '.';

const READY: TranslationStatus = {
  native_language: 'ru',
  status: 'installed',
  message: 'English → Russian is ready on this Mac.',
};
const DOWNLOAD: TranslationStatus = {
  native_language: 'ru',
  status: 'download_required',
  message: 'Prepare languages on this Mac, then retry.',
};

it('shows the backend message and marks an installed language as ready', () => {
  expect(availabilityCopy(READY, 'ru')).toEqual({ text: READY.message, tone: 'ready' });
  expect(availabilityCopy(DOWNLOAD, 'ru')).toEqual({ text: DOWNLOAD.message, tone: 'neutral' });
});

it('does not present availability reported for another language', () => {
  expect(availabilityCopy(READY, 'de')).toEqual({ text: CHECKING_AVAILABILITY, tone: 'neutral' });
  expect(needsPreparation(DOWNLOAD, 'de')).toBe(false);
});

it('offers preparation only when the selected language needs a download', () => {
  expect(needsPreparation(DOWNLOAD, 'ru')).toBe(true);
  expect(needsPreparation(READY, 'ru')).toBe(false);
});
