import { describe, expect, it } from 'bun:test';
import type { FocusRule } from '../../types';
import { focusRuleLine } from '.';

function rule(inSession: number, open: number): FocusRule {
  return {
    rule_key: 'articles',
    title: 'Articles',
    summary: 'A, an and the depend on whether the noun is new, known or unique.',
    in_session: inSession,
    open,
    came_back: false,
  };
}

describe('focusRuleLine', () => {
  it('counts the mistakes of today and the open ones', () => {
    expect(focusRuleLine(rule(3, 5))).toBe('3 times today · 5 open');
  });

  it('says one time in the singular', () => {
    expect(focusRuleLine(rule(1, 1))).toBe('1 time today · 1 open');
  });
});
