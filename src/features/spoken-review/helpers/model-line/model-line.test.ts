import { describe, expect, it } from 'bun:test';
import type { RecallResult } from '@/core/learning-memory';
import { modelLineOf } from './index';

const phrase: RecallResult = {
  run_id: 1,
  position: 1,
  item_type: 'phrase',
  item_id: 5,
  cue: 'cue',
  target: 'find a compromise',
  transcript: 'said',
  wording_observed: false,
  saved_response: 'need_practice',
  next_review_at: 1,
  interval_days: 1,
  status: 'learning',
};

describe('model line', () => {
  it('shows the generated model answer when there is one', () => {
    expect(modelLineOf(phrase, 'Could we find a compromise?')).toEqual({
      label: 'With the phrase',
      text: 'Could we find a compromise?',
    });
    expect(modelLineOf({ ...phrase, item_type: 'mistake' }, 'I work there.').label).toBe(
      'Said better',
    );
  });

  it('falls back to the saved wording', () => {
    expect(modelLineOf(phrase, null)).toEqual({ label: 'Saved phrase', text: 'find a compromise' });
    expect(modelLineOf({ ...phrase, item_type: 'mistake' }, null).label).toBe('Saved correction');
  });
});
