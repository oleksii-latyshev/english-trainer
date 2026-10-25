import { describe, expect, it } from 'bun:test';
import { aFinishedSession, aPhrase } from '../../tests/builders';
import { canSavePhrases, preparationView } from './index';

describe('preparationView', () => {
  it('offers a retry with the failure message when preparation failed', () => {
    const summary = aFinishedSession({
      wrapup_preparation: { state: 'failed', error: { code: 'timeout', message: 'Timed out.' } },
    });
    expect(preparationView(summary, undefined)).toEqual({ tag: 'failed', message: 'Timed out.' });
    expect(preparationView(summary, 'Try later.')).toEqual({
      tag: 'failed',
      message: 'Try later.',
    });
  });

  it('offers to prepare phrases for an older session', () => {
    const summary = aFinishedSession({ wrapup_preparation: { state: 'legacy' } });
    expect(preparationView(summary, undefined)).toEqual({ tag: 'prepare', message: undefined });
  });

  it('says what is going on while there are no phrases', () => {
    expect(
      preparationView(aFinishedSession({ wrapup_preparation: { state: 'pending' } }), undefined),
    ).toEqual({ tag: 'empty', message: 'Preparing phrases from your answers…' });
    expect(preparationView(aFinishedSession(), undefined)).toEqual({
      tag: 'empty',
      message: 'No phrases to keep from this session.',
    });
  });

  it('stays out of the way once phrases are listed', () => {
    expect(preparationView(aFinishedSession({ phrases: [aPhrase()] }), undefined)).toEqual({
      tag: 'none',
    });
  });

  it('shows a retry failure even when phrases are ready', () => {
    expect(preparationView(aFinishedSession(), 'Could not prepare phrases. Please retry.')).toEqual(
      { tag: 'error', message: 'Could not prepare phrases. Please retry.' },
    );
  });
});

describe('canSavePhrases', () => {
  it('waits for preparation to settle', () => {
    expect(canSavePhrases({ state: 'ready' })).toBe(true);
    expect(canSavePhrases({ state: 'legacy' })).toBe(true);
    expect(canSavePhrases({ state: 'pending' })).toBe(false);
    expect(canSavePhrases({ state: 'failed', error: { code: 'busy', message: 'x' } })).toBe(false);
  });
});
