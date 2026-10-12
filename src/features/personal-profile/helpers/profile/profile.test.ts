import { expect, it } from 'bun:test';
import { IpcDecodeError, IpcError, type PersonalProfile } from '@/core/ipc';
import { ProfileTooLong } from '../../errors';
import {
  EMPTY_PROFILE_SUMMARY,
  exceedsFieldLimit,
  fieldLength,
  PROFILE_TOO_LONG,
  profileSummary,
  SAVE_FAILED,
  saveProblemMessage,
} from '.';

const EMPTY: PersonalProfile = { role: '', stack: '', interests: '', goals: '' };

it('bounds each field independently and counts characters, not code units', () => {
  expect(exceedsFieldLimit({ ...EMPTY, role: 'x'.repeat(150) })).toBe(false);
  expect(exceedsFieldLimit({ ...EMPTY, goals: 'x'.repeat(151) })).toBe(true);
  expect(fieldLength('🙂'.repeat(150))).toBe(150);
  expect(exceedsFieldLimit({ ...EMPTY, stack: '🙂'.repeat(150) })).toBe(false);
});

it('summarizes only information the learner entered', () => {
  expect(profileSummary({ ...EMPTY, role: 'Engineer', interests: 'Cycling' })).toBe(
    'Engineer · Cycling',
  );
  expect(profileSummary({ ...EMPTY, role: '   ' })).toBe(EMPTY_PROFILE_SUMMARY);
});

it('explains an over-long field, a backend failure and an unreadable answer', () => {
  expect(saveProblemMessage(new ProfileTooLong({ limit: 150 }))).toBe(PROFILE_TOO_LONG);
  expect(
    saveProblemMessage(new IpcError({ code: 'database_error', message: 'Disk is full.' })),
  ).toBe('Disk is full.');
  expect(saveProblemMessage(new IpcDecodeError({ command: 'x', cause: 'y' }))).toBe(SAVE_FAILED);
});
