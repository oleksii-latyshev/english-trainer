import { expect, it } from 'bun:test';
import { phraseLabelOf } from './index';

it('asks for a phrase to be used and a mistake to be said better', () => {
  expect(phraseLabelOf('phrase')).toBe('Use this phrase');
  expect(phraseLabelOf('mistake')).toBe('Say it the better way');
});
