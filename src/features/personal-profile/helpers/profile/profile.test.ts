import { expect, it } from 'bun:test';
import { IpcDecodeError, IpcError, type PersonalProfile } from '@/core/ipc';
import { ProfileTooLong } from '../../errors';
import {
  EMPTY_PROFILE_SUMMARY,
  fieldLength,
  firstFieldOverLimit,
  learnerName,
  profileSummary,
  SAVE_FAILED,
  saveProblemMessage,
} from '.';

const EMPTY: PersonalProfile = { name: '', role: '', stack: '', interests: '', goals: '' };

it('bounds each field independently and counts characters, not code units', () => {
  expect(firstFieldOverLimit({ ...EMPTY, role: 'x'.repeat(150) })).toBeUndefined();
  expect(firstFieldOverLimit({ ...EMPTY, goals: 'x'.repeat(151) })?.label).toBe('Goals');
  expect(fieldLength('🙂'.repeat(150))).toBe(150);
  expect(firstFieldOverLimit({ ...EMPTY, stack: '🙂'.repeat(150) })).toBeUndefined();
});

it('limits the name to 40 characters after trimming', () => {
  expect(firstFieldOverLimit({ ...EMPTY, name: ` ${'x'.repeat(40)} ` })).toBeUndefined();
  expect(firstFieldOverLimit({ ...EMPTY, name: 'x'.repeat(41) })?.label).toBe('Name');
});

it('greets by the trimmed name', () => {
  expect(learnerName({ ...EMPTY, name: '  Oleksii ' })).toBe('Oleksii');
});

it('puts the name first in the summary', () => {
  expect(profileSummary({ ...EMPTY, name: 'Oleksii', role: 'Engineer' })).toBe(
    'Oleksii · Engineer',
  );
});

it('summarizes only information the learner entered', () => {
  expect(profileSummary({ ...EMPTY, role: 'Engineer', interests: 'Cycling' })).toBe(
    'Engineer · Cycling',
  );
  expect(profileSummary({ ...EMPTY, role: '   ' })).toBe(EMPTY_PROFILE_SUMMARY);
});

it('explains an over-long field, a backend failure and an unreadable answer', () => {
  expect(saveProblemMessage(new ProfileTooLong({ field: 'Name', limit: 40 }))).toBe(
    'Name must be 40 characters or fewer.',
  );
  expect(
    saveProblemMessage(new IpcError({ code: 'database_error', message: 'Disk is full.' })),
  ).toBe('Disk is full.');
  expect(saveProblemMessage(new IpcDecodeError({ command: 'x', cause: 'y' }))).toBe(SAVE_FAILED);
});
