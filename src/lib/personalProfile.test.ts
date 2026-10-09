// @ts-expect-error Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { isPersonalProfile, personalProfileSummary } from './personalProfileTypes';

describe('personal profile boundary', () => {
  it('accepts optional empty fields and bounds each field independently', () => {
    expect(isPersonalProfile({ role: '', stack: 'Rust, Tauri', interests: '', goals: '' })).toBe(
      true,
    );
    expect(isPersonalProfile({ role: 'x'.repeat(150), stack: '', interests: '', goals: '' })).toBe(
      true,
    );
    expect(isPersonalProfile({ role: 'x'.repeat(151), stack: '', interests: '', goals: '' })).toBe(
      false,
    );
    expect(isPersonalProfile({ role: '', stack: '', interests: '', goals: null })).toBe(false);
  });

  it('summarizes only information the learner entered', () => {
    expect(
      personalProfileSummary({ role: 'Engineer', stack: '', interests: 'Cycling', goals: '' }),
    ).toBe('Engineer · Cycling');
    expect(personalProfileSummary({ role: '', stack: '', interests: '', goals: '' })).toContain(
      'Add a little context',
    );
  });
});
