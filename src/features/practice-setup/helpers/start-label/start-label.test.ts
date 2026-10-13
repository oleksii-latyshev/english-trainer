import { expect, it } from 'bun:test';
import { startLabel } from './index';

it('names the first step of each practice mode', () => {
  expect(startLabel('voice', 'ready')).toBe('Start talking');
  expect(startLabel('text_chat', 'ready')).toBe('Start text chat');
  expect(startLabel('write_then_speak', 'ready')).toBe('Start writing');
});

it('says what is happening while restoring or starting', () => {
  expect(startLabel('voice', 'restoring')).toBe('Restoring your conversation…');
  expect(startLabel('text_chat', 'starting')).toBe('Starting…');
});
