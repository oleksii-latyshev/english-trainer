import { expect, it } from 'bun:test';
import { markedWords } from './index';

function marked(said: string, corrected: string): string[] {
  return markedWords(said, corrected)
    .filter((word) => word.isMarked)
    .map((word) => word.text);
}

it('marks the changed word', () => {
  expect(marked('that move', 'that moves')).toEqual(['moves']);
});

it('marks an inserted phrase', () => {
  expect(marked('I work on it since March.', 'I have been working on it since March.')).toEqual([
    'have',
    'been',
    'working',
  ]);
});

it('ignores case and punctuation', () => {
  expect(marked('i work there', 'I work there.')).toEqual([]);
});

it('marks moved words once they leave their order', () => {
  expect(marked('how exactly work this function', 'how exactly this function works')).toEqual([
    'works',
  ]);
});

it('keeps every word in order', () => {
  expect(markedWords('a b', 'a c b').map((word) => word.text)).toEqual(['a', 'c', 'b']);
});
