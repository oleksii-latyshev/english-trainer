import { expect, test } from 'bun:test';
import { unfinishedClausePauseMs } from '.';

test('a trailing comma lengthens the pause', () => {
  expect(unfinishedClausePauseMs('Yesterday I went home,')).toBe(1200);
  expect(unfinishedClausePauseMs('Yesterday I went home,  ')).toBe(1200);
});

test('a connector, article, preposition, possessive or auxiliary at the end lengthens the pause', () => {
  for (const text of [
    'I stayed because',
    'We talked about the',
    'I looked at my',
    'He said that they will',
    'It was nice and',
    'Maybe I',
  ]) {
    expect(unfinishedClausePauseMs(text)).toBe(1200);
  }
});

test('ignores case and trailing spaces', () => {
  expect(unfinishedClausePauseMs('I went to  The ')).toBe(1200);
});

test('a finished sentence adds nothing', () => {
  for (const text of [
    'I went home.',
    'It was great!',
    'Did you go?',
    'I like coffee',
    'We ate lunch',
  ]) {
    expect(unfinishedClausePauseMs(text)).toBe(0);
  }
});

test('a full stop wins over an open word', () => {
  expect(unfinishedClausePauseMs('That is what I wanted to say about it. And.')).toBe(0);
});

test('empty text adds nothing', () => {
  expect(unfinishedClausePauseMs('')).toBe(0);
  expect(unfinishedClausePauseMs('   ')).toBe(0);
});
