import { expect, it } from 'bun:test';
import { dueLabel, phraseSource } from './index';

it('counts what is due without pressure', () => {
  expect(dueLabel(4)).toBe('4 due');
});

it('joins the topic and the note of a phrase', () => {
  expect(phraseSource({ phrase: 'x', topic: 'Daily life', note: 'instead of "y"' })).toBe(
    'From Daily life · instead of "y"',
  );
  expect(phraseSource({ phrase: 'x', note: 'a note' })).toBe('a note');
  expect(phraseSource({ phrase: 'x' })).toBe('');
});
