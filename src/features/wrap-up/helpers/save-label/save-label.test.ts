import { describe, expect, it } from 'bun:test';
import { savePhrasesLabel } from './index';

describe('savePhrasesLabel', () => {
  it('counts the phrases left', () => {
    expect(savePhrasesLabel(1)).toBe('Save 1 phrase to Memory');
    expect(savePhrasesLabel(3)).toBe('Save all 3 phrases to Memory');
  });
});
