import { describe, expect, it } from 'bun:test';
import type { UsageFinding } from '../../types';
import { findingOutcome } from './index';

function aFinding(overrides: Partial<UsageFinding>): UsageFinding {
  return {
    item_type: 'phrase',
    item_id: 3,
    target: 'It saves me time.',
    outcome: 'correct',
    confidence: 0.95,
    exact_excerpt: 'it saves me time',
    credited: true,
    status_after: 'improving',
    ...overrides,
  };
}

describe('findingOutcome', () => {
  it('credits a correct use', () => {
    expect(findingOutcome(aFinding({}))).toEqual({
      label: 'Correct use credited',
      tone: 'success',
    });
  });

  it('shows an incorrect use as information, never red', () => {
    expect(findingOutcome(aFinding({ outcome: 'incorrect' }))).toEqual({
      label: 'Incorrect use observed',
      tone: 'warning',
    });
  });

  it('shows a use with help as neutral information, never as progress', () => {
    expect(findingOutcome(aFinding({ outcome: 'with_help' }))).toEqual({
      label: 'Used with help / no progress',
      tone: 'neutral',
    });
  });

  it('keeps an uncertain finding neutral', () => {
    expect(findingOutcome(aFinding({ outcome: 'uncertain', credited: false })).label).toBe(
      'Uncertain / no progress',
    );
  });

  it('says no progress was recorded when nothing was credited', () => {
    expect(findingOutcome(aFinding({ credited: false })).label).toBe('No progress recorded');
  });
});
