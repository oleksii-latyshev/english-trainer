import { expect, it } from 'bun:test';
import type { SessionDetails } from '@/core/practice-session';
import { rescueTargetOf } from './index';

const session = {
  sessionId: 7,
  question: 'How was your day?',
  turnCount: 2,
  practicePhase: 'speaking',
} as SessionDetails;

it('has no target without an open session', () => {
  expect(rescueTargetOf(undefined, 3)).toBeNull();
});

it('targets the next answer of the open question in the current recording', () => {
  expect(rescueTargetOf(session, 3)).toEqual({
    sessionId: 7,
    sequence: 3,
    question: 'How was your day?',
    recordingId: 3,
    key: '7:speaking:3:How was your day?:3',
  });
});

it('changes the key with the recording', () => {
  expect(rescueTargetOf(session, 4)?.key).not.toBe(rescueTargetOf(session, 3)?.key);
});
