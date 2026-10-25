import { describe, expect, it } from 'bun:test';
import type { SessionDetails } from '@/core/practice-session';
import { helpKeyOf, helpTargetOf } from './index';

const session = {
  sessionId: 7,
  practicePhase: 'speaking',
  turnCount: 1,
  question: 'How was your day?',
} as SessionDetails;

describe('help identity', () => {
  it('changes with the answer being given, so help never carries over to the next question', () => {
    const next = { ...session, turnCount: 2 } as SessionDetails;
    expect(helpKeyOf(session)).not.toBe(helpKeyOf(next));
  });

  it('has no target without a session', () => {
    expect(helpKeyOf(undefined)).toBe('none');
    expect(helpTargetOf(undefined)).toBeNull();
  });

  it('asks for the next answer of the open session', () => {
    expect(helpTargetOf(session)).toEqual({
      sessionId: 7,
      sequence: 2,
      question: 'How was your day?',
      key: '7:speaking:2:How was your day?',
    });
  });
});
