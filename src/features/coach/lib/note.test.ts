// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import type { AttemptComparison, TurnFeedback } from '@/lib/types';
import {
  isNoteOpen,
  latestPausedSequence,
  noteView,
  phraseToSave,
  secondTryHint,
  usedImprovedWording,
} from './note';

const feedback: TurnFeedback = {
  focus_feedback: [
    {
      category: 'grammar',
      original: 'every bank send',
      improved: 'every bank sends',
      explanation: 'After “every bank” the verb takes -s.',
    },
  ],
  b2_rewrite: 'Every bank sends them in a different format.',
};

const comparison: AttemptComparison = {
  turn_sequence: 2,
  original_transcript: 'every bank send them',
  retry_transcript: 'every bank sends them',
  target: 'every bank sends',
  target_evidence: 'newly_observed_in_retry',
  word_count_change: 0,
  hesitation: 'Not measured from transcript text.',
};

describe('noteView', () => {
  it('turns each coaching state into what the note shows', () => {
    expect(noteView({ state: 'pending' })).toEqual({ tag: 'checking' });
    expect(noteView({ state: 'paused' })).toEqual({ tag: 'paused' });
    expect(noteView({ state: 'failed' })).toEqual({ tag: 'failed' });
    expect(noteView({ state: 'ready', feedback })).toEqual({ tag: 'ready', feedback });
  });
});

describe('phraseToSave', () => {
  it('saves the improved wording with its explanation', () => {
    expect(phraseToSave(feedback)).toEqual({
      phrase: 'every bank sends',
      note: 'After “every bank” the verb takes -s.',
    });
  });

  it('saves the natural rewrite when there is no focus point', () => {
    expect(phraseToSave({ ...feedback, focus_feedback: [] })).toEqual({
      phrase: 'Every bank sends them in a different format.',
      note: 'Stronger phrasing from conversation feedback',
    });
  });

  it('has nothing to save when the phrase is too long for a Memory card', () => {
    expect(phraseToSave({ focus_feedback: [], b2_rewrite: 'word '.repeat(70).trim() })).toBeNull();
  });
});

describe('second try', () => {
  it('credits the improved wording only when it was heard', () => {
    expect(usedImprovedWording(comparison)).toBe(true);
    expect(usedImprovedWording({ ...comparison, target_evidence: 'already_present_in_both' })).toBe(
      true,
    );
    expect(usedImprovedWording({ ...comparison, target_evidence: 'not_observed' })).toBe(false);
    expect(usedImprovedWording({ ...comparison, target: '' })).toBe(false);
  });

  it('gives a calm hint when the wording was missing and none when unsure', () => {
    expect(secondTryHint({ ...comparison, target_evidence: 'not_observed' })).toBe(
      'Try “every bank sends” once more.',
    );
    expect(secondTryHint({ ...comparison, target_evidence: 'partially_observed' })).toContain(
      'Close',
    );
    expect(secondTryHint({ ...comparison, target_evidence: 'uncertain' })).toBe('');
    expect(secondTryHint(comparison)).toBe('');
  });
});

describe('isNoteOpen', () => {
  it('opens the newest answer and collapses older ones unless the learner chose', () => {
    expect(isNoteOpen(undefined, 4, 4)).toBe(true);
    expect(isNoteOpen(undefined, 3, 4)).toBe(false);
    expect(isNoteOpen(true, 3, 4)).toBe(true);
    expect(isNoteOpen(false, 4, 4)).toBe(false);
  });
});

describe('latestPausedSequence', () => {
  it('names the newest paused answer, counting from 1', () => {
    expect(
      latestPausedSequence([
        { state: 'paused' },
        { state: 'paused' },
        { state: 'ready', feedback },
        { state: 'pending' },
      ]),
    ).toBe(2);
    expect(latestPausedSequence([{ state: 'pending' }])).toBeNull();
    expect(latestPausedSequence(undefined)).toBeNull();
  });
});
